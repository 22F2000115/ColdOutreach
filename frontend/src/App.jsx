import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

// Create API Client instance
export const api = axios.create({ baseURL: 'http://localhost:8000' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth Context
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await api.get('/api/auth/me');
          setUser(res.data);
        } catch {
          localStorage.removeItem('token');
          setUser(null);
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  const login = async (email, password) => {
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);
    const res = await api.post('/api/auth/login', formData);
    localStorage.setItem('token', res.data.access_token);
    const userRes = await api.get('/api/auth/me');
    setUser(userRes.data);
  };

  const logout = () => { localStorage.removeItem('token'); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--muted-foreground)', fontFamily: 'var(--font-body)' }}>
      Loading…
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppLayout({ children }) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => { logout(); navigate('/login'); };

  const isActive = (path) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  return (
    <div className="dashboard-layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        {/* Brand */}
        <div style={{ paddingLeft: '4px' }}>
          <div style={{ fontFamily: 'var(--font-header)', fontSize: '1.4rem', fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-0.02em', marginBottom: '2px' }}>
            Cold<span style={{ color: 'var(--primary)' }}>Outreach</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 600 }}>
            {user?.email}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', padding: '0 4px', marginBottom: '4px' }}>
            Navigation
          </div>
          <Link
            to="/"
            className={`sidebar-nav-link${isActive('/') && !isActive('/settings') && !isActive('/campaigns/') ? ' active' : ''}`}
          >
            <span style={{ fontSize: '1rem' }}>⚡</span>
            Campaigns
          </Link>
          <Link
            to="/settings"
            className={`sidebar-nav-link${isActive('/settings') ? ' active' : ''}`}
          >
            <span style={{ fontSize: '1rem' }}>⚙️</span>
            SMTP Settings
          </Link>
        </nav>

        {/* Sign out */}
        <button
          className="btn btn-danger"
          style={{ width: '100%', fontSize: '0.85rem' }}
          onClick={handleLogout}
        >
          Sign Out
        </button>
      </aside>

      {/* ── Main ── */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import CampaignDetail from './pages/CampaignDetail';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/"         element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />
          <Route path="/campaigns/:id" element={<ProtectedRoute><AppLayout><CampaignDetail /></AppLayout></ProtectedRoute>} />
          <Route path="*"         element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
