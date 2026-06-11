/**
 * OutreachAI page — AI Template Generator.
 * Left column: single prompt textarea + generate button.
 * Right column: generated subject & body with {{placeholder}} highlighting, copy buttons, and "Use This Template" action.
 * Second tab: Saved Templates Library (unchanged behaviour).
 */

import { useState, useEffect } from 'react';
import { useAuth, api } from '../App';
import { Navigate } from 'react-router-dom';
import { getFriendlyError } from '../utils/errors';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function copyToClipboard(text, setCopied) {
  try {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
}

function convertPlainTextToHtml(text) {
  if (!text) return '';
  const normalized = text.replace(/\r\n/g, '\n');
  return normalized
    .split(/\n\n+/)
    .map(para => {
      const lineFormatted = para.split('\n').join('<br />');
      return `<p>${lineFormatted}</p>`;
    })
    .join('');
}

/**
 * Renders a string with {{placeholder}} tokens wrapped in a highlighted <span>.
 * Returns an array of React nodes.
 */
function renderWithHighlights(text) {
  if (!text) return null;
  const parts = text.split(/({{[^}]+}})/g);
  return parts.map((part, i) => {
    if (/^{{[^}]+}}$/.test(part)) {
      return (
        <span
          key={i}
          className="variable-pill"
          title="Click to fill or customize this variable when drafting your email"
        >
          {part}
        </span>
      );
    }
    return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
  });
}

// ── Copy Button ───────────────────────────────────────────────────────────────

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copy to clipboard"
      onClick={() => copyToClipboard(text, setCopied)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 9px',
        height: '24px',
        background: copied ? 'rgba(16,185,129,0.1)' : 'var(--bg-secondary)',
        border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'var(--border-subtle)'}`,
        borderRadius: '5px',
        fontSize: '0.68rem',
        fontWeight: 700,
        color: copied ? '#059669' : 'var(--muted-foreground)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        flexShrink: 0,
      }}
    >
      {copied ? (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
          Copied!
        </>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy
        </>
      )}
    </button>
  );
}

// ── Spinner / Loading skeleton ────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
      {/* Subject skeleton */}
      <div>
        <div style={{
          height: '12px', width: '60px', borderRadius: '4px',
          background: 'var(--border-subtle)', marginBottom: '8px',
          animation: 'shimmer 1.4s ease-in-out infinite'
        }} />
        <div style={{
          height: '38px', borderRadius: '8px',
          background: 'var(--border-subtle)',
          animation: 'shimmer 1.4s ease-in-out infinite'
        }} />
      </div>
      {/* Body skeleton */}
      <div>
        <div style={{
          height: '12px', width: '50px', borderRadius: '4px',
          background: 'var(--border-subtle)', marginBottom: '8px',
          animation: 'shimmer 1.4s ease-in-out infinite'
        }} />
        {[100, 85, 92, 70, 88].map((w, i) => (
          <div key={i} style={{
            height: '12px', width: `${w}%`, borderRadius: '4px',
            background: 'var(--border-subtle)', marginBottom: '8px',
            animation: `shimmer 1.4s ease-in-out ${i * 0.1}s infinite`
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OutreachAI() {
  const { user } = useAuth();

  const promptExamples = [
    { label: 'SaaS Demo Hook', text: 'Write a short cold email from a SaaS founder to CTOs asking for a 15-min demo' },
    { label: 'Freelance Pitch', text: 'Pitch my freelance UI/UX services to e-commerce brands, keep it casual' },
    { label: 'Job Referral', text: 'Job seeker reaching out to a recruiter for a referral, professional tone' }
  ];

  // Tab state
  const [activeTab, setActiveTab] = useState('generator');

  // Generator state
  const [prompt, setPrompt] = useState('');
  const [emailType, setEmailType] = useState('auto');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);   // { subject, body }
  const [error, setError] = useState(null);

  // Campaigns (for "Use This Template" action)
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [useSubmitting, setUseSubmitting] = useState(false);
  const [useSuccess, setUseSuccess] = useState(null);

  // Template library state
  const [templates, setTemplates] = useState([]);
  const [libraryCampaignSelections, setLibraryCampaignSelections] = useState({});
  const [libSubmitting, setLibSubmitting] = useState(false);
  const [libSuccess, setLibSuccess] = useState(null);
  const [libError, setLibError] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');

  useEffect(() => {
    document.title = 'Outreach AI - ColdOutreach';
    if (user?.plan !== 'trial') {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [campRes, tempRes] = await Promise.all([
        api.get('/api/campaigns'),
        api.get('/api/templates'),
      ]);
      const eligible = (campRes.data || []).filter(
        c => c.status === 'draft' || c.status === 'paused' || c.status === 'completed'
      );
      setCampaigns(eligible);
      setTemplates(tempRes.data || []);
    } catch { /* silent */ }
  };

  if (user?.plan === 'trial') {
    return <Navigate to="/" replace />;
  }

  // ── Generator handlers ──────────────────────────────────────────────────────

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError('Please describe what you want to say and to whom.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setUseSuccess(null);
    setSelectedCampaignId('');
    try {
      const typeLabel = {
        auto: null,
        job: 'Job / Recruiting Outreach',
        sales: 'Sales / Cold Outreach',
        partnership: 'Partnership / Collaboration',
        other: 'Other',
      }[emailType];

      const finalPrompt = [
        typeLabel ? `Email type: ${typeLabel}` : null,
        prompt.trim(),
        context.trim() ? `CONTEXT ABOUT ME / MY PRODUCT:\n${context.trim()}` : null,
      ]
        .filter(Boolean)
        .join('\n\n');

      const res = await api.post('/api/ai/generate-template', { prompt: finalPrompt });
      setResult(res.data);
    } catch (err) {
      setError(getFriendlyError(err, 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleUseTemplate = async () => {
    if (!selectedCampaignId || !result) return;
    const campaign = campaigns.find(c => c.id === parseInt(selectedCampaignId));
    if (!campaign) return;
    setUseSubmitting(true);
    setUseSuccess(null);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('name', campaign.name);
      fd.append('subject_template', result.subject.trim());
      fd.append('body_template', convertPlainTextToHtml(result.body.trim()));
      if (campaign.sender_id) fd.append('sender_id', campaign.sender_id);
      await api.put(`/api/campaigns/${campaign.id}`, fd);
      setUseSuccess(`Template inserted into "${campaign.name}".`);
    } catch (err) {
      setError(getFriendlyError(err, 'Something went wrong. Please try again.'));
    } finally {
      setUseSubmitting(false);
    }
  };

  // ── Library handlers ────────────────────────────────────────────────────────

  const handleSaveToLibrary = async (e) => {
    e.preventDefault();
    if (!saveTemplateName.trim() || !result) return;
    setLibSubmitting(true);
    setLibError(null);
    setLibSuccess(null);
    try {
      await api.post('/api/templates', {
        name: saveTemplateName.trim(),
        subject: result.subject.trim(),
        body: result.body.trim(),
        variables: [],
      });
      setLibSuccess(`Template "${saveTemplateName}" saved.`);
      setSaveTemplateName('');
      setShowSaveModal(false);
      fetchData();
    } catch (err) {
      setLibError(getFriendlyError(err, 'Something went wrong. Please try again.'));
    } finally {
      setLibSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm('Delete this template?')) return;
    try {
      await api.delete(`/api/templates/${id}`);
      setLibSuccess('Template deleted.');
      fetchData();
    } catch (err) {
      setLibError(getFriendlyError(err, 'Something went wrong.'));
    }
  };

  const handleOpenEditModal = (t) => {
    setEditingTemplate({ ...t });
    setShowEditModal(true);
  };

  const handleUpdateTemplate = async (e) => {
    e.preventDefault();
    if (!editingTemplate?.name?.trim()) return;
    try {
      await api.put(`/api/templates/${editingTemplate.id}`, {
        name: editingTemplate.name.trim(),
        subject: editingTemplate.subject.trim(),
        body: editingTemplate.body,
        variables: editingTemplate.variables,
      });
      setLibSuccess('Template updated.');
      setShowEditModal(false);
      setEditingTemplate(null);
      fetchData();
    } catch (err) {
      setLibError(getFriendlyError(err, 'Something went wrong.'));
    }
  };

  const handleDeployLibraryTemplate = async (t) => {
    const campaignId = libraryCampaignSelections[t.id];
    if (!campaignId) return;
    const campaign = campaigns.find(c => c.id === parseInt(campaignId));
    if (!campaign) return;
    setLibSubmitting(true);
    setLibError(null);
    setLibSuccess(null);
    try {
      const fd = new FormData();
      fd.append('name', campaign.name);
      fd.append('subject_template', t.subject);
      fd.append('body_template', convertPlainTextToHtml(t.body));
      if (campaign.sender_id) fd.append('sender_id', campaign.sender_id);
      await api.put(`/api/campaigns/${campaign.id}`, fd);
      setLibSuccess(`Template "${t.name}" injected into "${campaign.name}".`);
      setLibraryCampaignSelections(prev => ({ ...prev, [t.id]: '' }));
    } catch (err) {
      setLibError(getFriendlyError(err, 'Something went wrong.'));
    } finally {
      setLibSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="container" style={{ paddingBottom: '40px', animation: 'slideUp 0.3s var(--ease-smooth)' }}>

      {/* Shimmer keyframe injected inline once */}
      <style>{`
        @keyframes shimmer {
          0%   { opacity: 0.55; }
          50%  { opacity: 1; }
          100% { opacity: 0.55; }
        }
      `}</style>

      {/* Header */}
      <header className="page-header" style={{ marginBottom: '24px' }}>
        <h1 className="page-title">Outreach AI</h1>
        <p className="page-subtitle">
          Describe your email in plain language — the AI writes a campaign-ready template with smart placeholders.
        </p>
      </header>
 
      {/* Tabs */}
      <div className="tabs-container" style={{ marginBottom: '24px', background: 'transparent', padding: 0, borderBottom: '1px solid var(--border)' }}>
        <button
          type="button"
          className={`tab-btn${activeTab === 'generator' ? ' active' : ''}`}
          onClick={() => setActiveTab('generator')}
          style={{ padding: '12px 16px' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
          Outreach AI
        </button>
        <button
          type="button"
          className={`tab-btn${activeTab === 'library' ? ' active' : ''}`}
          onClick={() => setActiveTab('library')}
          style={{ padding: '12px 16px' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          Saved Templates Library ({templates.length})
        </button>
      </div>

      {/* ── Generator Tab ── */}
      {activeTab === 'generator' && (
        <div style={{ display: 'grid', gridTemplateColumns: '0.85fr 1.15fr', gap: '28px', alignItems: 'stretch' }}>

          {/* Left column: prompt + button */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Segmented Control Container */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Outreach Goal</span>
                <div style={{
                  display: 'inline-flex',
                  background: 'var(--bg-secondary)',
                  padding: '4px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-card)',
                  width: 'fit-content',
                  gap: '4px',
                }}>
                  {[
                    { value: 'auto', label: 'Auto Detect' },
                    { value: 'job', label: 'Job Outreach' },
                    { value: 'sales', label: 'Sales' },
                    { value: 'partnership', label: 'Partnership' },
                    { value: 'other', label: 'Other' }
                  ].map(opt => {
                    const isActive = emailType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEmailType(opt.value)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.25s var(--ease-smooth)',
                          backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                          color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                          border: 'none',
                          boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Textarea Prompt Block */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>What do you want to say?</span>
                <textarea
                  id="ai-prompt-input"
                  className="form-control"
                  style={{
                    minHeight: '200px',
                    resize: 'vertical',
                    fontSize: '0.93rem',
                    lineHeight: '1.6',
                    padding: '14px 16px',
                    borderRadius: '12px',
                  }}
                  placeholder="Describe your message... E.g., 'Pitch my graphic design skills to e-commerce brands' or choose one of the prefilled examples below."
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Clickable Example Tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginRight: '2px' }}>Try:</span>
                {promptExamples.map((ex, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="interactive-chip"
                    onClick={() => setPrompt(ex.text)}
                    disabled={loading}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" style={{ marginRight: '2px' }}>
                      <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                      <polyline points="2 17 12 22 22 17"></polyline>
                      <polyline points="2 12 12 17 22 12"></polyline>
                    </svg>
                    {ex.label}
                  </button>
                ))}
              </div>

              {/* Additional Context Textarea */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', opacity: 0.9, marginBottom: '2px' }}>
                  <label htmlFor="ai-context-input" style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    Additional Context
                  </label>
                  <span style={{
                    fontSize: '0.68rem',
                    marginLeft: '6px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--muted)',
                    color: 'var(--text-muted)',
                    fontWeight: 700,
                  }}>
                    (optional)
                  </span>
                </div>
                <textarea
                  id="ai-context-input"
                  className="form-control"
                  style={{
                    height: '110px',
                    minHeight: '80px',
                    resize: 'vertical',
                    fontSize: '0.88rem',
                    lineHeight: '1.5',
                    padding: '12px 14px',
                    borderRadius: '10px',
                  }}
                  placeholder={
                    {
                      auto: "Add details about yourself, product benefits, key outcomes, target client demographics...",
                      job: "Degree details, tech stacks, prominent projects, years of industry experience...",
                      sales: "Brand name, solution benefits, specific metrics, CTA details...",
                      partnership: "Collaboration pitch, target channels, win-win value propositions...",
                      other: "Background details that help customize the tone...",
                    }[emailType]
                  }
                  value={context}
                  onChange={e => setContext(e.target.value)}
                  disabled={loading}
                />
              </div>

              <button
                id="ai-generate-btn"
                type="submit"
                className="btn btn-primary glow-on-hover"
                disabled={loading || !prompt.trim()}
                style={{
                  height: '46px',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  borderRadius: '10px',
                }}
              >
                {loading ? (
                  <>
                    <span className="sending-dot" />
                    Generating copy...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                    Generate Template
                  </>
                )}
              </button>
            </form>

            {/* Inline error */}
            {error && (
              <div style={{
                fontSize: '0.82rem',
                color: 'var(--error)',
                padding: '10px 14px',
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '10px',
                lineHeight: '1.4',
              }}>
                {error}
              </div>
            )}
          </div>

          {/* Right column: High-fidelity Output sandbox */}
          <div className="email-window-mockup" style={{ minHeight: '480px', height: '100%' }}>
            
            {/* Mockup Toolbar Header */}
            <div className="email-window-header">
              <div className="email-window-dots">
                <span className="email-window-dot close" />
                <span className="email-window-dot minim" />
                <span className="email-window-dot expand" />
              </div>
              <span className="email-window-title">Outreach Sandbox</span>
              <div style={{ width: '42px' }} />
            </div>

            {/* Empty state */}
            {!loading && !result && (
              <div className="ai-empty-state">
                <div className="ai-empty-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                    <polyline points="2 17 12 22 22 17"></polyline>
                    <polyline points="2 12 12 17 22 12"></polyline>
                  </svg>
                </div>
                <h3 className="ai-empty-title">AI Sandbox Ready</h3>
                <p className="ai-empty-text">
                  Write what you want to say or try an example on the left, then click <strong>Generate Template</strong>.
                </p>
              </div>
            )}

            {/* Loading skeleton */}
            {loading && (
              <div className="email-window-body">
                <LoadingSkeleton />
              </div>
            )}

            {/* Result */}
            {!loading && result && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flexGrow: 1 }}>
                
                {/* Meta headers */}
                <div className="email-window-meta">
                  <div className="email-meta-row">
                    <span className="email-meta-label">From:</span>
                    <span className="email-meta-value" style={{ opacity: 0.8, fontSize: '0.8rem' }}>
                      AI Copywriter &lt;generator@coldoutreach.io&gt;
                    </span>
                  </div>
                  <div className="email-meta-row" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px', marginBottom: '2px' }}>
                    <span className="email-meta-label">To:</span>
                    <span className="email-meta-value" style={{ opacity: 0.8, fontSize: '0.8rem' }}>
                      {"{{Prospect Email}}"}
                    </span>
                  </div>
                  <div className="email-meta-row" style={{ alignItems: 'flex-start', paddingTop: '4px' }}>
                    <span className="email-meta-label" style={{ marginTop: '4px' }}>Subject:</span>
                    <div className="email-meta-value" style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{renderWithHighlights(result.subject)}</span>
                      <CopyButton text={result.subject} />
                    </div>
                  </div>
                </div>

                {/* Email Body Area */}
                <div className="email-window-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Email Template Body
                    </span>
                    <CopyButton text={result.body} />
                  </div>
                  <div style={{
                    padding: '16px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    lineHeight: '1.75',
                    color: 'var(--foreground)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    flexGrow: 1,
                  }}>
                    {renderWithHighlights(result.body)}
                  </div>
                </div>

                {/* Save + Deploy Tools */}
                <div style={{
                  borderTop: '1px solid var(--border-subtle)',
                  padding: '16px',
                  background: 'var(--bg-page)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  borderBottomLeftRadius: '12px',
                  borderBottomRightRadius: '12px',
                }}>
                  {/* Save to Library */}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => { setShowSaveModal(true); setSaveTemplateName(''); }}
                    style={{ height: '38px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                      <polyline points="17 21 17 13 7 13 7 21"></polyline>
                      <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                    Save to Library
                  </button>

                  {/* Inject directly into selected Campaign */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div className="custom-select-wrapper">
                      <select
                        id="ai-campaign-select"
                        className="form-control"
                        value={selectedCampaignId}
                        onChange={e => setSelectedCampaignId(e.target.value)}
                        style={{ height: '38px', fontSize: '0.82rem', appearance: 'none', background: 'var(--bg-card)' }}
                      >
                        <option value="">-- Choose Campaign to Use Template --</option>
                        {campaigns.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
                        ))}
                      </select>
                    </div>
                    <button
                      id="ai-use-template-btn"
                      type="button"
                      className="btn btn-primary glow-on-hover"
                      disabled={useSubmitting || !selectedCampaignId}
                      onClick={handleUseTemplate}
                      style={{ height: '38px', fontSize: '0.82rem', flexShrink: 0, padding: '0 14px' }}
                    >
                      {useSubmitting ? 'Saving...' : 'Use This Template'}
                    </button>
                  </div>

                  {useSuccess && (
                    <div style={{ fontSize: '0.80rem', color: '#059669', padding: '6px 10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px' }}>
                      {useSuccess}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Library Tab ── */}
      {activeTab === 'library' && (
        <div>
          {libError && (
            <div className="alert alert-error" style={{ marginBottom: '16px' }}>
              <span>{libError}</span>
            </div>
          )}
          {libSuccess && (
            <div className="alert alert-success" style={{ marginBottom: '16px' }}>
              <span>{libSuccess}</span>
            </div>
          )}

          {templates.length === 0 ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center', borderRadius: '12px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--muted)', color: 'var(--muted-foreground)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--foreground)' }}>Library is empty</h3>
              <p style={{ color: 'var(--muted-foreground)', fontSize: '0.84rem', maxWidth: '340px', margin: '6px auto 0' }}>
                Generate a template using the AI Generator and click "Save to Library" to catalog it here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
              {templates.map(t => (
                <div key={t.id} className="card" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                      <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.name}
                      </h3>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => handleOpenEditModal(t)}
                          style={{ border: 'none', background: 'none', padding: '4px', cursor: 'pointer', color: 'var(--muted-foreground)' }}
                          title="Edit Template"
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--muted-foreground)'}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(t.id)}
                          style={{ border: 'none', background: 'none', padding: '4px', cursor: 'pointer', color: 'var(--muted-foreground)' }}
                          title="Delete Template"
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--error)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--muted-foreground)'}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)', display: 'block', marginTop: '2px' }}>
                      Saved {new Date(t.created_at).toLocaleDateString()}
                    </span>

                    <div style={{ marginTop: '10px', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.82rem' }}>
                      <strong>Subject:</strong> {t.subject}
                    </div>

                    <p style={{ margin: '10px 0 0 0', fontSize: '0.78rem', color: 'var(--muted-foreground)', display: '-webkit-box', WebkitLineClamp: '3', WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                      {t.body}
                    </p>

                    {t.variables && t.variables.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '10px' }}>
                        {t.variables.map(v => (
                          <span key={v} style={{ fontSize: '0.66rem', padding: '2px 6px', background: 'var(--muted)', color: 'var(--muted-foreground)', borderRadius: '3px' }}>
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Deploy to campaign */}
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginTop: '8px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>
                      Deploy to campaign
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <select
                        className="form-control"
                        style={{ height: '32px', fontSize: '0.78rem', padding: '0 8px' }}
                        value={libraryCampaignSelections[t.id] || ''}
                        onChange={e => setLibraryCampaignSelections(prev => ({ ...prev, [t.id]: e.target.value }))}
                      >
                        <option value="">-- Choose Campaign --</option>
                        {campaigns.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
                        ))}
                      </select>
                      <button
                        className="btn btn-primary"
                        style={{ height: '32px', fontSize: '0.76rem', padding: '0 10px', flexShrink: 0 }}
                        disabled={libSubmitting || !libraryCampaignSelections[t.id]}
                        onClick={() => handleDeployLibraryTemplate(t)}
                      >
                        Inject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Save to Library ── */}
      {showSaveModal && result && (
        <div className="modal-backdrop" onClick={() => setShowSaveModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', borderRadius: '12px', border: '1px solid var(--border-card)', overflow: 'hidden' }}>
            <div className="modal-header">
              <h3 className="modal-title">Save Template to Library</h3>
              <button className="modal-close" onClick={() => setShowSaveModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveToLibrary}>
              <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {libError && <div style={{ fontSize: '0.80rem', color: 'var(--error)' }}>{libError}</div>}
                <div className="form-group">
                  <label className="form-label">Template Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Cold SaaS Pitch — Hook-First"
                    value={saveTemplateName}
                    onChange={e => setSaveTemplateName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preview</span>
                  <div style={{ fontSize: '0.80rem' }}>
                    <span style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>Subject: </span>
                    <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{result.subject}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--muted-foreground)', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: '3', WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-wrap' }}>
                    {result.body}
                  </p>
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', padding: '12px 24px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSaveModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={libSubmitting || !saveTemplateName.trim()}>
                  {libSubmitting ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Edit Saved Template ── */}
      {showEditModal && editingTemplate && (
        <div className="modal-backdrop" onClick={() => { setShowEditModal(false); setEditingTemplate(null); }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', borderRadius: '12px', border: '1px solid var(--border-card)', overflow: 'hidden' }}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Saved Template</h3>
              <button className="modal-close" onClick={() => { setShowEditModal(false); setEditingTemplate(null); }}>&times;</button>
            </div>
            <form onSubmit={handleUpdateTemplate}>
              <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Template Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingTemplate.name}
                    onChange={e => setEditingTemplate(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Subject</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingTemplate.subject}
                    onChange={e => setEditingTemplate(prev => ({ ...prev, subject: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Body</label>
                  <textarea
                    className="form-control"
                    style={{ minHeight: '220px', resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '0.84rem' }}
                    value={editingTemplate.body}
                    onChange={e => setEditingTemplate(prev => ({ ...prev, body: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', padding: '12px 24px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowEditModal(false); setEditingTemplate(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
