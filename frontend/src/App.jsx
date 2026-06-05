import { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import TrialExpiredModal from './components/TrialExpiredModal';
import logoLight from './assets/logo-light.png';
import logoDark from './assets/logo-dark.png';

// Create API Client instance
export const api = axios.create({ baseURL: '' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let setTrialExpiredGlobal = () => {};
let logoutGlobal = () => {};
let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token) {
  refreshSubscribers.map(cb => cb(token));
  refreshSubscribers = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Check for 402 Trial Expired
    if (error.response?.status === 402) {
      setTrialExpiredGlobal(true);
      return Promise.reject(error);
    }
    
    // Check for 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url === '/api/auth/refresh' || originalRequest.url === '/api/auth/login') {
        return Promise.reject(error);
      }
      
      originalRequest._retry = true;
      
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const res = await axios.post('/api/auth/refresh');
          const newToken = res.data.access_token;
          localStorage.setItem('token', newToken);
          isRefreshing = false;
          onRefreshed(newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch (err) {
          isRefreshing = false;
          logoutGlobal();
          return Promise.reject(err);
        }
      }
      
      return new Promise((resolve) => {
        subscribeTokenRefresh((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(api(originalRequest));
        });
      });
    }
    
    return Promise.reject(error);
  }
);

// Auth Context
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [trialExpired, setTrialExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {}
    localStorage.removeItem('token');
    setUser(null);
    setTrialExpired(false);
  };

  const fetchUser = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const res = await api.get('/api/auth/me');
        setUser(res.data);
        return res.data;
      } catch (err) {
        if (err.response?.status !== 402) {
          localStorage.removeItem('token');
          setUser(null);
        }
      }
    }
  };

  const refreshUser = async () => {
    return await fetchUser();
  };

  useEffect(() => {
    setTrialExpiredGlobal = setTrialExpired;
    logoutGlobal = logout;
  }, []);

  useEffect(() => {
    const initUser = async () => {
      await fetchUser();
      setLoading(false);
    };
    initUser();
  }, []);

  // Sync limits/status automatically on tab visibility changes
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && localStorage.getItem('token')) {
        fetchUser();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Sync limits/status automatically on window focus changes
  useEffect(() => {
    const handleFocus = () => {
      if (localStorage.getItem('token')) {
        fetchUser();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Safety poll every 5 minutes for idle sessions
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (localStorage.getItem('token')) {
        fetchUser();
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const login = async (email, password) => {
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);
    const res = await api.post('/api/auth/login', formData);
    localStorage.setItem('token', res.data.access_token);
    const userRes = await api.get('/api/auth/me');
    setUser(userRes.data);
    setTrialExpired(false);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, theme, toggleTheme, refreshUser }}>
      {children}
      {trialExpired && <TrialExpiredModal onSignOut={logout} />}
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

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--muted-foreground)', fontFamily: 'var(--font-body)' }}>
      Loading…
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}function AppLayout({ children }) {
  const { logout, user, theme, toggleTheme } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const getSidebarBadgeStyle = (role, plan, isDark) => {
    if (isDark) {
      if (role === 'admin') return { background: 'rgba(99, 102, 241, 0.25)', color: '#C7D2FE', border: '1px solid rgba(99, 102, 241, 0.4)' };
      if (plan === 'pro') return { background: 'rgba(99, 102, 241, 0.25)', color: '#C7D2FE', border: '1px solid rgba(99, 102, 241, 0.4)' };
      if (plan === 'trial') return { background: 'rgba(245, 158, 11, 0.25)', color: '#FBBF24', border: '1px solid rgba(245, 158, 11, 0.4)' };
      return { background: 'rgba(255, 255, 255, 0.1)', color: '#E2E8F0', border: '1px solid rgba(255, 255, 255, 0.15)' };
    }
    return {};
  };

  const isActive = (path) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Mobile Top Header */}
      <header className="mobile-header">
        <button className="hamburger-btn" onClick={() => setMobileMenuOpen(true)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <div style={{ fontFamily: 'var(--font-header)', fontSize: '1.1rem', fontWeight: 900, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--logo-blue)' }}>Cold</span><span style={{ color: 'var(--logo-dark)' }}>Outreach</span>
        </div>
        <button
          onClick={toggleTheme}
          className="theme-toggle-btn"
          style={{ width: '32px', height: '32px' }}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          )}
        </button>
      </header>

      <div className="dashboard-layout">
        {/* Backdrop for mobile */}
        {mobileMenuOpen && (
          <div className="sidebar-backdrop" onClick={() => setMobileMenuOpen(false)} />
        )}

        {/* ── Sidebar ── */}
        <aside className={`sidebar${mobileMenuOpen ? ' mobile-open' : ''}`} style={{ gap: '0' }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '4px', gap: '8px', marginBottom: '24px' }}>
            <img 
              src={theme === 'dark' ? logoDark : logoLight} 
              alt="ColdOutreach Logo" 
              style={{ height: '26px', width: 'auto', display: 'block', objectFit: 'contain' }} 
            />
            <div style={{ fontFamily: 'var(--font-header)', fontSize: '1.25rem', fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-0.02em', lineHeight: 1, transform: 'translateY(2px)' }}>
              <span style={{ color: 'var(--logo-blue)' }}>Cold</span><span style={{ color: 'var(--logo-dark)' }}>Outreach</span>
            </div>
          </div>

          {/* User Profile Card */}
          {user && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '4px 8px 16px 8px',
              background: 'transparent',
              border: 'none',
              boxShadow: 'none'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.82rem',
                letterSpacing: '0.05em',
                boxShadow: 'var(--shadow-sm)',
                flexShrink: 0
              }}>
                {user.email ? user.email.split('@')[0].substring(0, 2).toUpperCase() : 'U'}
              </div>
              <div style={{ minWidth: 0, flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div 
                  style={{ 
                    fontSize: '0.82rem', 
                    fontWeight: 600, 
                    color: theme === 'dark' ? '#E2E8F0' : '#374151', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap' 
                  }}
                  title={user.email}
                >
                  {user.email || 'User'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span 
                    className={`plan-badge plan-badge--${
                      user.role === 'admin' ? 'admin'
                      : user.plan === 'pro' ? 'pro'
                      : user.plan === 'trial' ? 'trial'
                      : 'free'
                    }`}
                    style={{ 
                      fontSize: '0.55rem', 
                      padding: '2px 6px', 
                      borderRadius: '3px',
                      fontWeight: 800,
                      letterSpacing: '0.05em',
                      ...getSidebarBadgeStyle(user.role, user.plan, theme === 'dark')
                    }}
                  >
                    {user.role === 'admin' ? 'Admin' : user.plan === 'pro' ? 'Pro' : user.plan === 'trial' ? 'Trial' : 'Free'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Divider below user info block */}
          {user && (
            <div style={{ 
              height: '1px', 
              background: theme === 'dark' ? '#2D2D3D' : '#E5E7EB', 
              marginBottom: '16px' 
            }} />
          )}
   
          {/* Nav */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <Link
              to="/"
              className={`sidebar-nav-link${isActive('/') && !isActive('/settings') && !isActive('/campaigns/') ? ' active' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M22 2L11 13"></path>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
              Campaigns
            </Link>
            <Link
              to="/settings"
              className={`sidebar-nav-link${isActive('/settings') ? ' active' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              SMTP Settings
            </Link>
            <Link
              to="/contact"
              className={`sidebar-nav-link${isActive('/contact') ? ' active' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              Contact Us
            </Link>
            {user?.role === 'admin' && (
              <Link
                to="/admin"
                className={`sidebar-nav-link${isActive('/admin') ? ' active' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="9" y1="3" x2="9" y2="21"></line>
                </svg>
                Admin Panel
              </Link>
            )}
          </nav>

          {/* Spacer */}
          <div style={{ flexGrow: 1 }} />
   
          {/* Divider above Sign Out */}
          <div style={{ height: '1px', background: theme === 'dark' ? '#2D2D3D' : '#E5E7EB', marginBottom: '16px' }} />
  
          {/* Sign out */}
          <button
            onClick={handleLogout}
            className="sidebar-signout-btn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Sign Out
          </button>
        </aside>

        {/* ── Main ── */}
        <main className="main-content" style={{ position: 'relative' }}>
          <div className="floating-theme-toggle">
            <button
              onClick={toggleTheme}
              className="theme-toggle-btn"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              )}
            </button>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import CampaignDetail from './pages/CampaignDetail';
import AdminDashboard from './pages/AdminDashboard';
import Contact from './pages/Contact';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/"         element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />
          <Route path="/contact"  element={<ProtectedRoute><AppLayout><Contact /></AppLayout></ProtectedRoute>} />
          <Route path="/campaigns/:id" element={<ProtectedRoute><AppLayout><CampaignDetail /></AppLayout></ProtectedRoute>} />
          <Route path="/admin"    element={<AdminRoute><AppLayout><AdminDashboard /></AppLayout></AdminRoute>} />
          <Route path="*"         element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
