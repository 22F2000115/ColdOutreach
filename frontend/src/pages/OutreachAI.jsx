/**
 * OutreachAI page allows generating personalized outreach templates using AI,
 * fine-tuning tone/length constraints, spam analysis, and saving templates to a library.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth, api } from '../App';
import { Navigate } from 'react-router-dom';

// ── Constants ─────────────────────────────────────────────────────────────────

const TONE_OPTIONS = [
  { id: 'professional', label: 'Professional' },
  { id: 'casual', label: 'Casual' },
  { id: 'startup-style', label: 'Startup-style' },
  { id: 'bold', label: 'Bold / Persuasive' },
  { id: 'recruiter-friendly', label: 'Recruiter-friendly' },
  { id: 'empathetic', label: 'Empathetic / consultative' }
];

const STYLE_OPTIONS = [
  { id: 'conversational', label: 'Conversational' },
  { id: 'structured', label: 'Structured / Bulleted' },
  { id: 'narrative', label: 'Story-driven' }
];

const QUICK_START_PRESETS = [
  {
    label: 'Job Seeker',
    role: 'Computer Science student / Recent graduate',
    objective: 'Get a referral or book an informational interview',
    targetAudience: 'Software engineers, hiring managers, and recruiters at tech companies',
    skillsOrOffer: 'Strong Python & React skills, 2 personal SaaS projects, GPA 3.8, eager to learn in a fast-paced environment',
    tone: 'recruiter-friendly',
    formality: 'formal',
    ctaStrength: 'soft',
    writingStyle: 'conversational'
  },
  {
    label: 'SaaS Pitch',
    role: 'SaaS Founder / Co-founder',
    objective: 'Book a product demo or discovery call',
    targetAudience: 'CTOs and VPs of Engineering at Series A to Series B startups',
    skillsOrOffer: 'AI-powered email outreach platform that automates cold campaigns, reduces manual effort by 70%, and increases reply rates by 3x using smart personalization',
    tone: 'startup-style',
    formality: 'informal',
    ctaStrength: 'direct',
    writingStyle: 'conversational'
  },
  {
    label: 'Freelancer',
    role: 'Freelance UI/UX Designer',
    objective: 'Land a new client design project or retainer',
    targetAudience: 'Marketing leads and e-commerce brand managers at DTC brands doing $1M–$10M revenue',
    skillsOrOffer: 'Figma-first designer with 5 years of experience, 40+ landing pages delivered, average 28% increase in client conversion rates after redesign, specializing in SaaS and e-commerce UI',
    tone: 'casual',
    formality: 'informal',
    ctaStrength: 'soft',
    writingStyle: 'conversational'
  },
  {
    label: 'B2B Sales',
    role: 'Senior Account Executive / B2B Sales Rep',
    objective: 'Schedule a discovery call to discuss a potential solution fit',
    targetAudience: 'Operations Managers and COOs at mid-size logistics and supply chain companies with 50–500 employees',
    skillsOrOffer: 'Enterprise logistics SaaS platform that reduces manual dispatch time by 45%, integrates with existing WMS tools in under 2 weeks, and has delivered $2M+ in operational savings for clients in 2024',
    tone: 'professional',
    formality: 'formal',
    ctaStrength: 'direct',
    writingStyle: 'structured'
  }
];

const SPAM_PHRASES = [
  'free', 'guarantee', 'click here', 'buy now', 'risk-free', 'winner',
  'limited time', 'cash', 'save money', 'earn money', 'make money',
  'congratulations', 'act now', 'no obligation', 'special promotion',
  'double your', 'incredible deal', 'no cost', 'order now', 'urgent',
  'you have been selected', "you've been chosen", '100% free',
  'as seen on', 'be your own boss', 'extra income', 'financial freedom',
  'get paid', 'home based', 'pure profit', 'work from home',
  'no experience', 'amazing offer', 'bonus', 'prize', 'won',
  'lose weight', 'miracle', 'unsubscribe', 'click below', 'apply now',
  'dear friend', 'increase your sales'
];

const POWER_WORDS = [
  'results', 'proven', 'specific', 'quick', 'honest', 'bold', 'real',
  'direct', 'simple', 'fast', 'smart', 'truth', 'secret', 'exact',
  'finally', 'new', 'unique', 'idea', 'thought', 'noticed'
];

const LENGTH_TARGETS = { short: { min: 0, max: 100 }, medium: { min: 120, max: 160 }, long: { min: 200, max: 250 } };

// ── Helpers ───────────────────────────────────────────────────────────────────

function countWords(text) {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function checkSpam(subjectText, bodyText) {
  const fullText = ((subjectText || '') + ' ' + (bodyText || '')).toLowerCase();
  return SPAM_PHRASES.filter(phrase => fullText.includes(phrase));
}

function getSubjectEffectiveness(subjectStr) {
  if (!subjectStr) return { personalized: false, charCount: 0, hasPowerWord: false };
  const lower = subjectStr.toLowerCase();
  const personalized = /\{\{(first_name|company|[^}]+)\}\}/.test(subjectStr);
  const charCount = subjectStr.length;
  const hasPowerWord = POWER_WORDS.some(w => lower.includes(w));
  return { personalized, charCount, hasPowerWord };
}

async function copyToClipboard(text, setCopied) {
  try {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch {
    // fallback for older browsers
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function OutreachAI() {
  const { user, theme } = useAuth();

  // State hooks
  const [activeTab, setActiveTab] = useState('generator');
  const [role, setRole] = useState('');
  const [objective, setObjective] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [skillsOrOffer, setSkillsOrOffer] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [senderName, setSenderName] = useState(user?.email?.split('@')[0] || '');
  const [tone, setTone] = useState('professional');
  const [length, setLength] = useState('medium');
  const [formality, setFormality] = useState('formal');
  const [ctaStrength, setCtaStrength] = useState('soft');
  const [writingStyle, setWritingStyle] = useState('conversational');
  const [generatedData, setGeneratedData] = useState(null);
  const [selectedSubjectIndex, setSelectedSubjectIndex] = useState(0);
  const [selectedVariationIndex, setSelectedVariationIndex] = useState(0);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [libraryCampaignSelections, setLibraryCampaignSelections] = useState({});
  const [submittingGeneration, setSubmittingGeneration] = useState(false);
  const [submittingMoreSubjects, setSubmittingMoreSubjects] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Derived values/variables
  const isDark = theme === 'dark';
  const detectedSpam = checkSpam(editedSubject, editedBody);
  const wordCount = countWords(editedBody);
  const lengthTarget = LENGTH_TARGETS[length] || LENGTH_TARGETS.medium;
  const wordCountOk = wordCount >= lengthTarget.min && wordCount <= lengthTarget.max;
  const wordCountOver = wordCount > lengthTarget.max;

  // useEffect hooks
  useEffect(() => {
    if (user?.plan !== 'trial') {
      fetchData();
    }
    document.title = 'AI Template Generator - ColdOutreach';
  }, [user]);

  // Sync edits to previews when variations or selection index changes
  useEffect(() => {
    if (generatedData) {
      const activeSubject = generatedData.subjects[selectedSubjectIndex] || '';
      const activeBody = generatedData.variations[selectedVariationIndex]?.body || '';
      setEditedSubject(activeSubject);
      setEditedBody(activeBody);
    }
  }, [generatedData, selectedSubjectIndex, selectedVariationIndex]);

  // Handler and helper functions
  const fetchData = async () => {
    try {
      const [campRes, tempRes] = await Promise.all([
        api.get('/api/campaigns'),
        api.get('/api/templates')
      ]);
      const eligible = (campRes.data || []).filter(
        c => c.status === 'draft' || c.status === 'paused' || c.status === 'completed'
      );
      setCampaigns(eligible);
      setTemplates(tempRes.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong. Please try again.");
    }
  };

  // Apply a quick-start preset
  const applyPreset = (preset) => {
    setRole(preset.role);
    setObjective(preset.objective);
    setTargetAudience(preset.targetAudience);
    setSkillsOrOffer(preset.skillsOrOffer);
    setTone(preset.tone);
    setFormality(preset.formality);
    setCtaStrength(preset.ctaStrength);
    setWritingStyle(preset.writingStyle);
    setGeneratedData(null);
    setError(null);
    setSuccess(null);
  };

  // Handle AI generation
  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    if (!role.trim() || !objective.trim() || !targetAudience.trim() || !skillsOrOffer.trim()) {
      setError('Please fill in all required inputs: Role, Objective, Target Audience, and Skills/Offer.');
      return;
    }

    setSubmittingGeneration(true);
    setError(null);
    setSuccess(null);
    setGeneratedData(null);

    try {
      const res = await api.post('/api/ai/generate-email', {
        role: role.trim(),
        objective: objective.trim(),
        target_audience: targetAudience.trim(),
        skills_or_offer: skillsOrOffer.trim(),
        additional_context: additionalContext.trim() || null,
        sender_name: senderName.trim(),
        tone,
        length,
        formality,
        cta_strength: ctaStrength,
        writing_style: writingStyle
      });
      setGeneratedData(res.data);
      setSelectedSubjectIndex(0);
      setSelectedVariationIndex(0);
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setSubmittingGeneration(false);
    }
  };

  // Generate more subject lines without re-generating bodies
  const handleGenerateMoreSubjects = async () => {
    if (!generatedData || !role.trim()) return;

    setSubmittingMoreSubjects(true);
    setError(null);

    try {
      const res = await api.post('/api/ai/generate-subjects', {
        role: role.trim(),
        objective: objective.trim(),
        target_audience: targetAudience.trim(),
        skills_or_offer: skillsOrOffer.trim() || null,
        existing_subjects: generatedData.subjects,
        tone,
        count: 3
      });

      const newSubjects = res.data?.subjects || [];
      if (newSubjects.length > 0) {
        const merged = [...generatedData.subjects, ...newSubjects];
        setGeneratedData(prev => ({ ...prev, subjects: merged }));
        // Select first newly generated subject
        setSelectedSubjectIndex(generatedData.subjects.length);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setSubmittingMoreSubjects(false);
    }
  };

  // Sync active variation to chosen campaign
  const handleUseInCampaign = async () => {
    if (!selectedCampaignId || !editedBody) return;

    const campaign = campaigns.find(c => c.id === parseInt(selectedCampaignId));
    if (!campaign) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const fd = new FormData();
      fd.append('name', campaign.name);
      fd.append('subject_template', editedSubject.trim());
      fd.append('body_template', convertPlainTextToHtml(editedBody.trim()));
      if (campaign.sender_id) {
        fd.append('sender_id', campaign.sender_id);
      }

      await api.put(`/api/campaigns/${campaign.id}`, fd);
      setSuccess(`Successfully updated campaign "${campaign.name}" with the template!`);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Save current template to library
  const handleSaveToLibrary = async (e) => {
    e.preventDefault();
    if (!saveTemplateName.trim() || !editedBody) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post('/api/templates', {
        name: saveTemplateName.trim(),
        subject: editedSubject.trim(),
        body: editedBody.trim(),
        variables: generatedData?.variables || []
      });
      setSuccess(`Template "${saveTemplateName}" saved to your library.`);
      setSaveTemplateName('');
      setShowSaveModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Library CRUD handlers
  const handleDeleteTemplate = async (templateId) => {
    if (!confirm('Are you sure you want to delete this template from your library?')) return;

    try {
      await api.delete(`/api/templates/${templateId}`);
      setSuccess('Template deleted successfully.');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong. Please try again.");
    }
  };

  const handleOpenEditModal = (template) => {
    setEditingTemplate({
      id: template.id,
      name: template.name,
      subject: template.subject,
      body: template.body,
      variables: template.variables
    });
    setShowEditModal(true);
  };

  const handleUpdateTemplate = async (e) => {
    e.preventDefault();
    if (!editingTemplate || !editingTemplate.name.trim() || !editingTemplate.subject.trim() || !editingTemplate.body.trim()) return;

    try {
      await api.put(`/api/templates/${editingTemplate.id}`, {
        name: editingTemplate.name.trim(),
        subject: editingTemplate.subject.trim(),
        body: editingTemplate.body,
        variables: editingTemplate.variables
      });
      setSuccess('Template updated successfully.');
      setShowEditModal(false);
      setEditingTemplate(null);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong. Please try again.");
    }
  };

  const handleDeployLibraryTemplate = async (template) => {
    const campaignId = libraryCampaignSelections[template.id];
    if (!campaignId) return;

    const campaign = campaigns.find(c => c.id === parseInt(campaignId));
    if (!campaign) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const fd = new FormData();
      fd.append('name', campaign.name);
      fd.append('subject_template', template.subject);
      fd.append('body_template', convertPlainTextToHtml(template.body));
      if (campaign.sender_id) {
        fd.append('sender_id', campaign.sender_id);
      }

      await api.put(`/api/campaigns/${campaign.id}`, fd);
      setSuccess(`Successfully injected template "${template.name}" into campaign "${campaign.name}"!`);
      setLibraryCampaignSelections(prev => ({ ...prev, [template.id]: '' }));
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (user?.plan === 'trial') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container" style={{ paddingBottom: '40px', animation: 'slideUp 0.3s var(--ease-smooth)' }}>
      {/* Header */}
      <header className="page-header" style={{ marginBottom: '24px' }}>
        <h1 className="page-title">AI Template Generation System</h1>
        <p className="page-subtitle">
          Generate, edit, and catalog multi-variant outreach templates with dynamic placeholders, then deploy them directly into campaigns.
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
          AI Template Generator
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

      {/* Alert Notifications */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '20px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ marginBottom: '20px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>{success}</span>
        </div>
      )}

      {/* ── Tab Content: Generator ── */}
      {activeTab === 'generator' && (
        <div className="campaign-workspace" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'stretch' }}>
          {/* Left Column: Input Form & Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Quick-Start Presets */}
            <div className="card" style={{ padding: '18px 24px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quick-Start Presets</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {QUICK_START_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: 'var(--foreground)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      lineHeight: 1.3
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.background = 'var(--primary-subtle)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--foreground)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Specifications Card */}
            <div className="card" style={{ padding: '24px', borderRadius: '12px' }}>
              <h2 className="section-title" style={{ marginBottom: '18px' }}>Template Specifications</h2>
              <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Your Role / Identity *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Founder, student, sales rep"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Your Objective / Goal *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Secure a job referral, book product demo, pitch custom designs"
                    value={objective}
                    onChange={e => setObjective(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Target Audience (Person / Company) *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Recruiters, CTOs at tech startups, local dentists"
                    value={targetAudience}
                    onChange={e => setTargetAudience(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Your Skills, Offer, Experience, or Product *</label>
                  <textarea
                    className="form-control"
                    style={{ minHeight: '80px', resize: 'vertical' }}
                    placeholder="Provide details of what you bring or sell (e.g., Python/Django developer with 2 built APIs, SaaS outreach tool scaling email inbox infrastructure)"
                    value={skillsOrOffer}
                    onChange={e => setSkillsOrOffer(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Additional Context (Optional)</label>
                  <textarea
                    className="form-control"
                    style={{ minHeight: '60px', resize: 'vertical' }}
                    placeholder="Any relevant context (e.g. 'Met them briefly at a conference', 'Keep layout ultra-short')"
                    value={additionalContext}
                    onChange={e => setAdditionalContext(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Sender Name (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Raj"
                    value={senderName}
                    onChange={e => setSenderName(e.target.value)}
                  />
                </div>
              </form>
            </div>

            {/* Template Parameter Controls Card */}
            <div className="card" style={{ padding: '24px', borderRadius: '12px' }}>
              <h2 className="section-title" style={{ marginBottom: '18px' }}>Template Controls</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Tone</label>
                    <select className="form-control" value={tone} onChange={e => setTone(e.target.value)}>
                      {TONE_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Writing Style</label>
                    <select className="form-control" value={writingStyle} onChange={e => setWritingStyle(e.target.value)}>
                      {STYLE_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Email Length</label>
                  <div className="email-length-group">
                    {['short', 'medium', 'long'].map(l => {
                      const getLabels = (val) => {
                        switch (val) {
                          case 'short':
                            return { title: 'Quick & Punchy', range: '<100 words' };
                          case 'medium':
                            return { title: 'Balanced & Persuasive', range: '120–160 words' };
                          case 'long':
                            return { title: 'Detailed & Technical', range: '200–250 words' };
                          default:
                            return { title: val, range: '' };
                        }
                      };
                      const info = getLabels(l);
                      const isSelected = length === l;
                      return (
                        <label
                          key={l}
                          className={`email-length-option ${isSelected ? 'selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="email-length"
                            checked={isSelected}
                            onChange={() => setLength(l)}
                            className="email-length-radio"
                          />
                          <div className="email-length-content">
                            <span className="email-length-title">{info.title}</span>
                            <span className="email-length-range">{info.range}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Formality</label>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                      {['formal', 'informal'].map(f => (
                        <button
                          key={f}
                          type="button"
                          className={`btn ${formality === f ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '6px 14px', fontSize: '0.78rem', height: '32px', flexGrow: 1, textTransform: 'capitalize' }}
                          onClick={() => setFormality(f)}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">CTA Strength</label>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                      {['soft', 'direct'].map(c => (
                        <button
                          key={c}
                          type="button"
                          className={`btn ${ctaStrength === c ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '6px 14px', fontSize: '0.78rem', height: '32px', flexGrow: 1, textTransform: 'capitalize' }}
                          onClick={() => setCtaStrength(c)}
                        >
                          {c} {c === 'soft' ? '(Interest)' : '(Meeting)'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleGenerate}
                  className="btn btn-primary"
                  style={{ width: '100%', height: '42px', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  disabled={submittingGeneration}
                >
                  {submittingGeneration ? (
                    <><span className="sending-dot" /> Generating Custom Template...</>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                        <polyline points="2 17 12 22 22 17"></polyline>
                        <polyline points="2 12 12 17 22 12"></polyline>
                      </svg>
                      Generate Template
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Output Preview Editor & Campaign Deployment */}
          <div className="card" style={{ padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'flex-start' }}>
            <h2 className="section-title" style={{ marginBottom: '18px' }}>Generated Template Package</h2>

            {submittingGeneration && (
              <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '128px 0' }}>
                <div style={{ animation: 'pulsing 1.5s infinite alternate', width: '64px', height: '64px', borderRadius: '50%', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                  </svg>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 600 }}>AI is crafting your template package...</div>
                <div style={{ color: 'var(--muted-foreground)', fontSize: '0.82rem', textAlign: 'center', maxWidth: '300px' }}>
                  Writing 3 distinct variations, optimizing subject lines, and detecting dynamic placeholders.
                </div>
              </div>
            )}

            {!submittingGeneration && !generatedData && (
              <div className="empty-state" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '128px 0' }}>
                <div className="empty-state-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', background: 'var(--muted)', color: 'var(--muted-foreground)', margin: '0 auto 16px auto' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                    <polyline points="2 17 12 22 22 17"></polyline>
                    <polyline points="2 12 12 17 22 12"></polyline>
                  </svg>
                </div>
                <h3>Awaiting Inputs</h3>
                <p style={{ maxWidth: '320px', margin: '8px auto 0' }}>
                  Provide details about your role and target audience in the left panel, or pick a Quick-Start preset, then click Generate.
                </p>
              </div>
            )}

            {!submittingGeneration && generatedData && (
              <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, gap: '16px' }}>
                {/* Detected Placeholders list */}
                <div>
                  <label className="form-label" style={{ marginBottom: '6px' }}>Dynamic Variables Detected</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {generatedData.variables.length === 0 && (
                      <span style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)' }}>No variables detected.</span>
                    )}
                    {generatedData.variables.map(v => (
                      <span key={v} style={{ padding: '4px 10px', background: 'var(--primary-subtle)', color: 'var(--primary)', border: '1px solid var(--primary-border)', borderRadius: '100px', fontSize: '0.74rem', fontWeight: 700 }}>
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Subject picker */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label className="form-label" style={{ margin: 0 }}>Subject Line Options</label>
                    <button
                      type="button"
                      onClick={handleGenerateMoreSubjects}
                      disabled={submittingMoreSubjects}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 10px',
                        height: '26px',
                        background: 'var(--primary-subtle)',
                        border: '1px solid var(--primary-border)',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: 'var(--primary)',
                        cursor: submittingMoreSubjects ? 'not-allowed' : 'pointer',
                        opacity: submittingMoreSubjects ? 0.6 : 1,
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => !submittingMoreSubjects && (e.currentTarget.style.background = 'var(--primary-border)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--primary-subtle)')}
                    >
                      {submittingMoreSubjects ? (
                        <><span className="sending-dot" style={{ width: '6px', height: '6px' }} /> Generating...</>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          More Subjects
                        </>
                      )}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {generatedData.subjects.map((s, idx) => {
                      const eff = getSubjectEffectiveness(s);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedSubjectIndex(idx)}
                          style={{
                            textAlign: 'left',
                            padding: '10px 14px',
                            background: selectedSubjectIndex === idx ? 'var(--primary-subtle)' : 'var(--bg-secondary)',
                            border: `1px solid ${selectedSubjectIndex === idx ? 'var(--primary)' : 'var(--border-subtle)'}`,
                            borderRadius: 'var(--radius)',
                            fontSize: '0.84rem',
                            fontWeight: selectedSubjectIndex === idx ? 700 : 500,
                            color: selectedSubjectIndex === idx ? 'var(--primary)' : 'var(--foreground)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input type="radio" checked={selectedSubjectIndex === idx} readOnly style={{ accentColor: 'var(--primary)', flexShrink: 0 }} />
                            <span style={{ flexGrow: 1 }}>{s}</span>
                          </div>
                          {/* Subject effectiveness micro-scores */}
                          <div style={{ display: 'flex', gap: '5px', paddingLeft: '24px', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '0.62rem', fontWeight: 600, padding: '1px 6px', borderRadius: '4px',
                              background: eff.personalized ? 'rgba(16,185,129,0.1)' : 'var(--muted)',
                              color: eff.personalized ? '#059669' : 'var(--muted-foreground)',
                              border: `1px solid ${eff.personalized ? 'rgba(16,185,129,0.2)' : 'transparent'}`
                            }}>
                              {eff.personalized ? '✓ Personalized' : '○ Generic'}
                            </span>
                            <span style={{
                              fontSize: '0.62rem', fontWeight: 600, padding: '1px 6px', borderRadius: '4px',
                              background: eff.charCount <= 45 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                              color: eff.charCount <= 45 ? '#059669' : '#D97706',
                              border: `1px solid ${eff.charCount <= 45 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`
                            }}>
                              {eff.charCount} chars {eff.charCount > 45 ? '⚠ long' : '✓'}
                            </span>
                            {eff.hasPowerWord && (
                              <span style={{ fontSize: '0.62rem', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: 'var(--primary-subtle)', color: 'var(--primary)', border: '1px solid var(--primary-border)' }}>
                                ⚡ Power word
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Variation Selection Tab */}
                <div>
                  <label className="form-label" style={{ marginBottom: '6px' }}>Email Variations</label>
                  <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: '10px' }}>
                    {generatedData.variations.map((v, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedVariationIndex(idx)}
                        style={{
                          padding: '8px 14px',
                          background: 'none',
                          border: 'none',
                          borderBottom: selectedVariationIndex === idx ? '2px solid var(--primary)' : '2px solid transparent',
                          fontSize: '0.78rem',
                          fontWeight: selectedVariationIndex === idx ? 700 : 500,
                          color: selectedVariationIndex === idx ? 'var(--primary)' : 'var(--muted-foreground)',
                          cursor: 'pointer',
                        }}
                      >
                        {v.name || `Variant ${idx + 1}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Editable Preview Box */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Subject field with copy button */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <label className="form-label" style={{ margin: 0 }}>Subject</label>
                      <button
                        type="button"
                        title="Copy subject"
                        onClick={() => copyToClipboard(editedSubject, setCopiedSubject)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', height: '22px', background: copiedSubject ? 'rgba(16,185,129,0.1)' : 'var(--bg-secondary)', border: `1px solid ${copiedSubject ? 'rgba(16,185,129,0.3)' : 'var(--border-subtle)'}`, borderRadius: '5px', fontSize: '0.66rem', fontWeight: 700, color: copiedSubject ? '#059669' : 'var(--muted-foreground)', cursor: 'pointer', transition: 'all 0.15s' }}
                      >
                        {copiedSubject ? (
                          <><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Copied!</>
                        ) : (
                          <><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>
                        )}
                      </button>
                    </div>
                    <input
                      type="text"
                      className="form-control"
                      value={editedSubject}
                      onChange={e => setEditedSubject(e.target.value)}
                    />
                  </div>

                  {/* Body field with copy + word count */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label className="form-label" style={{ margin: 0 }}>Email Body</label>
                        {/* Word count badge */}
                        {editedBody && (
                          <span style={{
                            fontSize: '0.62rem', fontWeight: 700, padding: '1px 7px', borderRadius: '5px',
                            background: wordCountOk ? 'rgba(16,185,129,0.1)' : wordCountOver ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                            color: wordCountOk ? '#059669' : wordCountOver ? '#DC2626' : '#D97706',
                            border: `1px solid ${wordCountOk ? 'rgba(16,185,129,0.2)' : wordCountOver ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                            whiteSpace: 'nowrap'
                          }}>
                            {wordCount}w · Target {length === 'short' ? '<100' : length === 'medium' ? '120–160' : '200–250'}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        title="Copy body"
                        onClick={() => copyToClipboard(editedBody, setCopiedBody)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', height: '22px', background: copiedBody ? 'rgba(16,185,129,0.1)' : 'var(--bg-secondary)', border: `1px solid ${copiedBody ? 'rgba(16,185,129,0.3)' : 'var(--border-subtle)'}`, borderRadius: '5px', fontSize: '0.66rem', fontWeight: 700, color: copiedBody ? '#059669' : 'var(--muted-foreground)', cursor: 'pointer', transition: 'all 0.15s' }}
                      >
                        {copiedBody ? (
                          <><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Copied!</>
                        ) : (
                          <><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>
                        )}
                      </button>
                    </div>
                    <textarea
                      className="form-control"
                      style={{ minHeight: '180px', resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '0.86rem' }}
                      value={editedBody}
                      onChange={e => setEditedBody(e.target.value)}
                    />
                  </div>
                </div>

                {/* Spam Flag warnings */}
                {detectedSpam.length > 0 && (
                  <div className="spam-warning" style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.15)', display: 'flex', gap: '10px', alignItems: 'flex-start', color: '#B91C1C' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: '2px' }}>
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                      <line x1="12" y1="9" x2="12" y2="13"></line>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <span style={{ fontSize: '0.78rem', lineHeight: '1.4' }}>
                      <strong>Spam Trigger Warning:</strong> The template contains phrases that may alert spam filters: <strong>{detectedSpam.join(', ')}</strong>. We recommend replacing them.
                    </span>
                  </div>
                )}

                {/* Save to library & Campaign synchronization */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => { setShowSaveModal(true); setSaveTemplateName(''); }}
                      style={{ padding: '0 16px', height: '40px', fontSize: '0.85rem', flexGrow: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                        <polyline points="7 3 7 8 15 8"></polyline>
                      </svg>
                      Save to Library
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleGenerate()}
                      disabled={submittingGeneration}
                      style={{ padding: '0 16px', height: '40px', fontSize: '0.85rem', gap: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                      Regenerate
                    </button>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ marginBottom: '6px' }}>Directly Insert into Campaign</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        className="form-control"
                        value={selectedCampaignId}
                        onChange={e => setSelectedCampaignId(e.target.value)}
                        style={{ flexGrow: 1 }}
                      >
                        <option value="">-- Select Campaign (Draft, Paused or Completed) --</option>
                        {campaigns.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.status})
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn btn-primary"
                        onClick={handleUseInCampaign}
                        disabled={submitting || !selectedCampaignId}
                        style={{ flexShrink: 0, padding: '0 16px', height: '40px' }}
                      >
                        {submitting ? 'Syncing...' : 'Insert into Campaign'}
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab Content: Library ── */}
      {activeTab === 'library' && (
        <div>
          {templates.length === 0 ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center', borderRadius: '12px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--muted)', color: 'var(--muted-foreground)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--foreground)' }}>Library is empty</h3>
              <p style={{ color: 'var(--muted-foreground)', fontSize: '0.84rem', maxWidth: '340px', margin: '6px auto 0' }}>
                You haven't saved any outreach templates yet. Generate templates using AI and click "Save to Library" to catalog them here.
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

                  {/* Deploy to campaign option */}
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
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.status})
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn btn-primary"
                        style={{ height: '32px', fontSize: '0.76rem', padding: '0 10px', flexShrink: 0 }}
                        disabled={submitting || !libraryCampaignSelections[t.id]}
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

      {/* ── Modal Dialog: Save to Library ── */}
      {showSaveModal && (
        <div className="modal-backdrop" onClick={() => setShowSaveModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Save Template to Library</h3>
              <button className="modal-close" onClick={() => setShowSaveModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveToLibrary}>
              <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Template Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Cold SaaS Pitch - Hook-First"
                    value={saveTemplateName}
                    onChange={e => setSaveTemplateName(e.target.value)}
                    required
                    autoFocus
                  />
                  <span style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)', display: 'block', marginTop: '6px' }}>
                    Give the template a descriptive name to organize your outreach library.
                  </span>
                </div>

                {/* Preview of what's being saved */}
                {(editedSubject || editedBody) && (
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preview</span>
                    {editedSubject && (
                      <div style={{ fontSize: '0.80rem' }}>
                        <span style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>Subject: </span>
                        <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{editedSubject}</span>
                      </div>
                    )}
                    {editedBody && (
                      <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--muted-foreground)', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: '4', WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-wrap' }}>
                        {editedBody}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', padding: '12px 24px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSaveModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting || !saveTemplateName.trim()}>
                  {submitting ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Dialog: Edit Saved Template ── */}
      {showEditModal && editingTemplate && (
        <div className="modal-backdrop" onClick={() => { setShowEditModal(false); setEditingTemplate(null); }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
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
                <button type="button" className="btn btn-secondary" onClick={() => { setShowEditModal(false); setEditingTemplate(null); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
