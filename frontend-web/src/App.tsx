import { Routes, Route, Link, useNavigate, Navigate, useLocation, matchPath } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from './lib/api';
import './lib/i18n';
import { UserCtx, useUser } from './lib/user-context';
import Home from './pages/Home';
import BookDetail from './pages/BookDetail';
import Chapter from './pages/Chapter';
import Submit from './pages/Submit';
import Login from './pages/Login';
import Register from './pages/Register';
import Admin from './pages/Admin';
import AdminLogin from './pages/AdminLogin';
import ApplyCharacter from './pages/ApplyCharacter';

// Admin 路由保护
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  if (loading) return null;
  if (!user) return <Navigate to="/admin/login" />;
  if (user.role !== 'admin') return <Navigate to="/" />;
  return <>{children}</>;
}

// 管理员访问前台页面时重定向到 /admin
function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  if (loading) return null;
  if (user?.role === 'admin') return <Navigate to="/admin" />;
  return <>{children}</>;
}

// 登录后路由保护
function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

function Navbar() {
  const { t, i18n } = useTranslation();
  const { user, setUser } = useUser();
  const navigate = useNavigate();

  // Navbar 不再负责 auth 初始化，由 App 统一处理


  const toggleLang = () => {
    const lang = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(lang); localStorage.setItem('lang', lang);
  };

  return (
    <nav className="nav">
      <Link to={user?.role === 'admin' ? '/admin' : '/'} className="nav-logo">AI Novel</Link>
      <div className="nav-links">
        {user?.role === 'admin' ? (
          <>
            <Link to="/admin">👑 Admin</Link>
            <span className="nav-user">{user.username}</span>
            <button onClick={() => { api.logout(); setUser(null); navigate('/admin/login'); }}>{t('auth.logout')}</button>
          </>
        ) : (
          <>
            <Link to="/">{t('nav.home')}</Link>
            <button onClick={toggleLang}>🌐 {i18n.language === 'zh' ? 'EN' : '中'}</button>
            {user ? (
              <>
                <Link to="/submit">{t('nav.submit')}</Link>
                <span className="nav-user">{user.username}</span>
                <button onClick={() => { api.logout(); setUser(null); navigate('/'); }}>{t('auth.logout')}</button>
              </>
            ) : (
              <>
                <Link to="/login">{t('auth.login')}</Link>
                <Link to="/register">{t('auth.register')}</Link>
              </>
            )}
          </>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const hideNavbar = Boolean(matchPath('/books/:id/chapters/:num', location.pathname));

  // Auth 初始化 — 页面加载时检查登录状态
  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api.me()
        .then(u => setUser(u))
        .catch(() => { api.logout(); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  return (
    <UserCtx.Provider value={{ user, setUser, loading }}>
      <div className="app">
        {!hideNavbar && <Navbar />}
        <main className="main">
          <Routes>
            <Route path="/" element={<AdminGuard><Home /></AdminGuard>} />
            <Route path="/books/:id" element={<AdminGuard><BookDetail /></AdminGuard>} />
            <Route path="/books/:id/chapters/:num" element={<AdminGuard><Chapter /></AdminGuard>} />
            <Route path="/books/:id/apply-character" element={<AdminGuard><AuthRoute><ApplyCharacter /></AuthRoute></AdminGuard>} />
            <Route path="/submit" element={<AuthRoute><Submit /></AuthRoute>} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
          </Routes>
        </main>
      </div>
    </UserCtx.Provider>
  );
}
