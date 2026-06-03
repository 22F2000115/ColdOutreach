import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

export default function Register() {
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error,           setError]           = useState('');
  const [success,         setSuccess]         = useState(false);
  const [loading,         setLoading]         = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('email', email);
      fd.append('password', password);
      await axios.post('http://localhost:8000/api/auth/register', fd);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Try a different email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: '20px', background: 'var(--background)'
    }}>
      <div style={{ maxWidth: '400px', width: '100%' }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontFamily: 'var(--font-header)', fontSize: '1.8rem', fontWeight: 900, marginBottom: '6px' }}>
            Cold<span style={{ color: 'var(--primary)' }}>Outreach</span>
          </div>
          <p style={{ color: 'var(--muted-foreground)', fontSize: '0.88rem' }}>
            Create an account to start your first campaign
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '32px' }}>
          <h1 style={{ fontFamily: 'var(--font-header)', fontSize: '1.35rem', fontWeight: 800, marginBottom: '24px', textAlign: 'center' }}>
            Create Account
          </h1>

          {error   && <div className="alert alert-error">⚠️ {error}</div>}
          {success && <div className="alert alert-success">🎉 Account created! Redirecting…</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" className="form-control" placeholder="name@company.com"
                value={email} onChange={e => setEmail(e.target.value)} required disabled={loading || success} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-control" placeholder="Min. 8 characters"
                value={password} onChange={e => setPassword(e.target.value)} required disabled={loading || success} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input type="password" className="form-control" placeholder="••••••••"
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required disabled={loading || success} />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '4px', padding: '11px' }} disabled={loading || success}>
              {loading ? 'Creating…' : 'Create Account →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 700 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
