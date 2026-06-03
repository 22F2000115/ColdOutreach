import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../App';

export default function Login() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed. Please check your credentials.');
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
            Sign in to your email outreach workspace
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '32px' }}>
          <h1 style={{ fontFamily: 'var(--font-header)', fontSize: '1.35rem', fontWeight: 800, marginBottom: '24px', textAlign: 'center' }}>
            Welcome back
          </h1>

          {error && (
            <div className="alert alert-error">⚠️ {error}</div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" className="form-control" placeholder="name@company.com"
                value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-control" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '4px', padding: '11px' }} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 700 }}>Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
