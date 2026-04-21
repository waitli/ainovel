import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useUser } from '../lib/user-context';
import { useSeo } from '../lib/seo';

export default function AdminLogin() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  useSeo({
    title: lang === 'zh' ? '管理员登录 | AI Novel' : 'Admin Login | AI Novel',
    description: lang === 'zh' ? 'AI Novel 管理员登录入口。' : 'Administrator login for AI Novel.',
    lang,
    path: '/admin/login',
    noindex: true,
    enableHreflang: false,
  });
  const navigate = useNavigate();
  const { setUser } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const d = await api.login(email, password);
      if (d.user.role !== 'admin') {
        api.logout();
        setUser(null);
        setError('Access denied. Admin account required.');
        setLoading(false);
        return;
      }
      setUser(d.user);
      navigate('/admin');
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-wrap">
      <div className="auth-page">
        <div className="auth-head">
          <div className="auth-icon">👑</div>
          <h2>Admin Login</h2>
          <p className="subtitle">管理员专用登录入口</p>
        </div>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="admin@example.com" />
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
          <button type="submit" disabled={loading} className="btn btn-block form-actions">
            {loading ? '⏳ Signing in...' : '🔑 Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
