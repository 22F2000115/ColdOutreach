/**
 * FAQ & Help Center Page
 * Provides interactive search, category filters, and animated accordion self-help guides.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const FAQ_DATA = [
  {
    id: 1,
    category: 'smtp',
    question: 'How do I connect a Gmail account as a sender?',
    answer: 'Go to Settings > Add Sender Account. For Gmail, you cannot use your main login password. Instead, you must generate a Google App Password. Go to your Google Account > Security > 2-Step Verification > App Passwords, create a password labeled "Mail" or "ColdOutreach", and paste the 16-character code into the password field.'
  },
  {
    id: 2,
    category: 'smtp',
    question: 'What SMTP port and encryption settings should I select?',
    answer: 'For SSL connections, use port 465. For TLS or STARTTLS connections, use port 587. The system will automatically perform a connection test when you save your configuration, verifying your credentials and network settings upfront to prevent campaign errors.'
  },
  {
    id: 3,
    category: 'smtp',
    question: 'How does the "Send Delay" feature prevent mailbox suspension?',
    answer: 'In Settings, you can configure a custom Send Delay (between 1 and 60 seconds) for each SMTP account. During campaign execution, the background worker pauses for this amount of time between each outgoing email. This paces out your traffic, mimics natural human behavior, and keeps you within mail provider daily transaction limits.'
  },
  {
    id: 4,
    category: 'ai',
    question: 'How does the AI Template Generator work?',
    answer: 'Navigate to Outreach AI in the sidebar (available on Pro accounts). Select your outreach type — Auto Detect, Job Outreach, Sales, Partnership, or Other. Type a plain-language description of what you want to say and to whom in the prompt box. Optionally add context about yourself or your product in the "Additional Context" field so the AI writes real prose instead of generic placeholders. Click "Generate Template" to receive a single, campaign-ready subject line and email body powered by Google Gemini (with Groq as automatic fallback).'
  },
  {
    id: 5,
    category: 'ai',
    question: 'How do {{placeholder}} variables work in generated templates?',
    answer: 'The generated template uses {{double_curly_braces}} placeholders only for data that is genuinely recipient-specific — such as {{first_name}}, {{company}}, or {{role}}. These are highlighted visually in the output so you can see exactly which fields will be personalized per contact. The more context you provide in the "Additional Context" field, the fewer placeholders the AI will use, since it writes real facts directly into the email prose instead.'
  },
  {
    id: 6,
    category: 'ai',
    question: 'How do I manage and inject saved templates?',
    answer: 'In the generator preview, click "Save to Library" to catalog your email copy. In the "Saved Templates Library" tab, you can edit templates inside a plain text editor, delete old drafts, or choose a campaign from the dropdown and click "Inject" to directly apply the template body and subject.'
  },
  {
    id: 7,
    category: 'campaigns',
    question: 'What file format should my CSV contact import list follow?',
    answer: 'Your CSV file must include an "email" column (case-insensitive) containing the contact addresses. To use template personalization, you can optionally include headers like "first_name", "last_name", "company", and "role". The maximum file upload size is 6 MB.'
  },
  {
    id: 8,
    category: 'campaigns',
    question: 'How do I use personalization variables in campaigns?',
    answer: 'Insert placeholders inside double brackets in your email subject or body templates—for example, "Hi {{first_name}}, I noticed {{company}} is growing...". When the background sender processes the campaign, it replaces these brackets with the recipient\'s specific database records.'
  },
  {
    id: 9,
    category: 'campaigns',
    question: 'How does Bounce Synchronization protect my sender reputation?',
    answer: 'A background worker automatically runs every 30 minutes, logging into your campaign sender mailboxes via IMAP. It checks for delivery failure reports (Mailer-Daemon) since campaign launch, updates matching contact records to "failed" status, and logs the specific error code. You can also trigger this manually from the History or Campaign Detail pages.'
  }
];

const CATEGORIES = [
  { id: 'all', label: 'All Guides' },
  { id: 'smtp', label: 'SMTP & Deliverability' },
  { id: 'ai', label: 'Outreach AI & Templates' },
  { id: 'campaigns', label: 'Campaigns & Leads' }
];

export default function FAQ() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [expandedItems, setExpandedItems] = useState({});

  useEffect(() => {
    document.title = 'FAQ & Help Center - ColdOutreach';
  }, []);

  const toggleItem = (itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const filteredFaqs = FAQ_DATA.filter((faq) => {
    const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
    const matchesSearch =
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div style={{ animation: 'slideUp 0.3s var(--ease-smooth)', maxWidth: '840px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Back to support navigation */}
      <Link
        to="/contact"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          color: 'var(--muted-foreground)',
          fontSize: '0.8rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          textDecoration: 'none',
          marginBottom: '16px',
          transition: 'color 0.15s ease'
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--muted-foreground)'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        Back to Support
      </Link>

      {/* Header */}
      <header className="page-header" style={{ marginBottom: '28px' }}>
        <h1 className="page-title">FAQ & Help Center</h1>
        <p className="page-subtitle">
          Find answers regarding SMTP setups, mail server deliverability configurations, variable templating, and our Outreach AI engine.
        </p>
      </header>

      {/* Search Input */}
      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--muted-foreground)"
          strokeWidth="2.2"
          style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
        >
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          id="faq_search_input"
          type="text"
          className="form-control"
          placeholder="Search question, configuration topics, or keywords..."
          style={{ paddingLeft: '44px', height: '48px', borderRadius: '10px', fontSize: '0.92rem', background: 'var(--bg-secondary)' }}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center' }}
            title="Clear search"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`btn ${activeCategory === c.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              height: '32px',
              borderRadius: '20px',
              background: activeCategory === c.id ? 'var(--primary)' : 'var(--bg-secondary)',
              border: activeCategory === c.id ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
              color: activeCategory === c.id ? 'var(--primary-foreground)' : 'var(--foreground)'
            }}
            onClick={() => setActiveCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* FAQ Accordion List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredFaqs.length === 0 ? (
          <div className="card" style={{ padding: '36px', textAlign: 'center', color: 'var(--muted-foreground)', borderRadius: '12px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px', opacity: 0.5 }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>No self-help articles found.</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem' }}>Try adjusting your search criteria or switching categories.</p>
          </div>
        ) : (
          filteredFaqs.map((faq) => {
            const isExpanded = !!expandedItems[faq.id];
            return (
              <div
                key={faq.id}
                className="card"
                style={{
                  borderRadius: '12px',
                  border: isExpanded ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                  transition: 'all 0.2s ease',
                  overflow: 'hidden'
                }}
              >
                {/* Header Header */}
                <button
                  type="button"
                  style={{
                    width: '100%',
                    padding: '18px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    gap: '16px'
                  }}
                  onClick={() => toggleItem(faq.id)}
                >
                  <span style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--foreground)' }}>
                    {faq.question}
                  </span>
                  <span
                    style={{
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      color: isExpanded ? 'var(--primary)' : 'var(--muted-foreground)',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </span>
                </button>

                {/* Collapsible Answer */}
                <div
                  style={{
                    maxHeight: isExpanded ? '400px' : '0px',
                    opacity: isExpanded ? 1 : 0,
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ padding: '0 24px 18px 24px', fontSize: '0.88rem', color: 'var(--muted-foreground)', lineHeight: 1.6 }}>
                    {faq.answer}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer / Contact Support Note */}
      <div style={{
        marginTop: '48px',
        textAlign: 'center',
        padding: '24px',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px'
      }}>
        <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
          Still have questions?
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', margin: 0 }}>
          Can't find what you are looking for? Reach out to our <Link to="/contact" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline' }}>Support Team</Link> directly.
        </p>
      </div>
    </div>
  );
}
