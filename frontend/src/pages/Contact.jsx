import { useState, useEffect } from 'react';
import { api } from '../App';

export default function Contact() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchContacts = async () => {
    try {
      const res = await api.get('/api/contact-details');
      setContacts(res.data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch contact details. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const emails = contacts.filter(c => c.type === 'email');
  const whatsapps = contacts.filter(c => c.type === 'whatsapp');

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--muted-foreground)' }}>
        Loading Contact details…
      </div>
    );
  }

  return (
    <div style={{ animation: 'slideUp 0.3s var(--ease-smooth)', maxWidth: '960px', margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1 className="page-title">Contact Us</h1>
          <p className="page-subtitle">Have questions about your plan limits, Gmail configurations, or system issues? Get in touch with our team.</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '24px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '28px', marginTop: '12px' }}>
        
        {/* Email Card */}
        <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', transition: 'transform 0.2s var(--ease-spring)', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifycontent: 'center', flexShrink: 0, padding: '12px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div>
              <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Email Support</h2>
              <span className="eyebrow" style={{ fontSize: '0.64rem' }}>Drop us a line</span>
            </div>
          </div>

          <div className="divider" />

          {emails.length === 0 ? (
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.88rem', fontStyle: 'italic' }}>No email addresses configured.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {emails.map((e) => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border-subtle)' }}>
                  <div>
                    {e.label && <strong style={{ display: 'block', fontSize: '0.78rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>{e.label}</strong>}
                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--foreground)' }}>{e.value}</span>
                  </div>
                  <a href={`mailto:${e.value}`} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.78rem', height: '30px' }}>
                    Email
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* WhatsApp Card */}
        <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', transition: 'transform 0.2s var(--ease-spring)', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', display: 'flex', alignItems: 'center', justifycontent: 'center', flexShrink: 0, padding: '12px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </div>
            <div>
              <h2 className="section-title" style={{ fontSize: '1.2rem' }}>WhatsApp Chat</h2>
              <span className="eyebrow" style={{ fontSize: '0.64rem' }}>Instant messaging</span>
            </div>
          </div>

          <div className="divider" />

          {whatsapps.length === 0 ? (
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.88rem', fontStyle: 'italic' }}>No WhatsApp numbers configured.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {whatsapps.map((w) => {
                const cleanNum = w.value.replace(/[^\d+]/g, '');
                const formattedNum = w.value.startsWith('+') ? w.value : `+${w.value}`;
                return (
                  <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border-subtle)' }}>
                    <div>
                      {w.label && <strong style={{ display: 'block', fontSize: '0.78rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>{w.label}</strong>}
                      <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--foreground)' }}>{formattedNum}</span>
                    </div>
                    <a href={`https://wa.me/${cleanNum.replace('+', '')}`} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.78rem', height: '30px', borderColor: 'rgba(34, 197, 94, 0.25)', color: '#16a34a' }}>
                      Message
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
