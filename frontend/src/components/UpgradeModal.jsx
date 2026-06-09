import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../App';

export default function UpgradeModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchContacts();
    }
  }, [isOpen]);

  const fetchContacts = async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const res = await api.get('/api/contact-details');
      setContacts(res.data || []);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const emails = contacts.filter(c => c.type === 'email');
  const whatsapps = contacts.filter(c => c.type === 'whatsapp');

  const handleContactUs = () => {
    onClose();
    navigate('/contact');
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      fontFamily: 'var(--font-body)',
      padding: '24px',
      animation: 'fadeIn 0.25s var(--ease-smooth)'
    }}>
      <div style={{
        maxWidth: '440px',
        width: '100%',
        background: 'var(--card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-lg)',
        padding: '32px',
        textAlign: 'center',
        animation: 'scaleIn 0.3s var(--ease-spring)'
      }}>
        {/* Crown Icon */}
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'var(--primary-subtle, rgba(99, 102, 241, 0.08))',
          color: 'var(--primary, #6366F1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"></path>
            <path d="M3 20h18v2H3v-2z"></path>
          </svg>
        </div>

        <h2 style={{
          fontFamily: 'var(--font-header)',
          fontSize: '1.4rem',
          fontWeight: 800,
          color: 'var(--foreground)',
          marginBottom: '10px'
        }}>
          Upgrade to Pro
        </h2>

        <p style={{
          fontSize: '0.88rem',
          color: 'var(--muted-foreground)',
          lineHeight: '1.5',
          marginBottom: '24px'
        }}>
          To upgrade your account to Pro, get in touch with our team. We'll activate your account manually.
        </p>

        {/* Contact Links */}
        <div style={{ marginBottom: '28px', textAlign: 'left' }}>
          {loading ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', textAlign: 'center' }}>Loading contact options...</p>
          ) : fetchError || contacts.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', textAlign: 'center', margin: 0 }}>
              Reach out via the Contact Us page.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {emails.map(e => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{e.label || 'Email'}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.value}</span>
                  </div>
                  <a href={`mailto:${e.value}`} className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.74rem', height: '26px', flexShrink: 0 }}>
                    Email
                  </a>
                </div>
              ))}
              {whatsapps.map(w => {
                const cleanNum = w.value.replace(/[^\d+]/g, '').replace('+', '');
                return (
                  <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{w.label || 'WhatsApp'}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.value}</span>
                    </div>
                    <a href={`https://wa.me/${cleanNum}`} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.74rem', height: '26px', flexShrink: 0 }}>
                      Chat
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleContactUs}
            className="btn btn-primary"
            style={{
              flex: 1,
              padding: '10px',
              fontSize: '0.88rem',
              fontWeight: 700,
              justifyContent: 'center'
            }}
          >
            Contact Us
          </button>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{
              flex: 1,
              padding: '10px',
              fontSize: '0.88rem',
              fontWeight: 700,
              justifyContent: 'center',
              background: 'transparent',
              borderColor: 'var(--border-subtle)'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
