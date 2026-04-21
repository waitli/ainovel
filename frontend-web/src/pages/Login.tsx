import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useUser } from '../lib/user-context';
import { useSeo } from '../lib/seo';

export default function Login() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  useSeo({
    title: lang === 'zh' ? '登录 | AI Novel' : 'Login | AI Novel',
    description: lang === 'zh' ? '登录 AI Novel 继续阅读与创作。' : 'Log in to AI Novel to continue reading and creating.',
    lang,
    path: '/login',
    noindex: true,
    enableHreflang: false,
  });
  const navigate = useNavigate();
  const { setUser } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const d = await api.login(email, password);
      setUser(d.user);
      navigate('/');
    }
    catch (e: any) { setError(e.message); }
  };

  return (
    <div className="auth-page">
      <div className="auth-icon">📚</div>
      <h1>{t('auth.welcomeBack')}</h1>
      <p className="subtitle">{t('auth.loginSubtitle')}</p>
      <form onSubmit={handleLogin}>
        {error && <p className="error-msg">{error}</p>}
        <input type="email" placeholder={t('auth.email')} value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder={t('auth.password')} value={password} onChange={e => setPassword(e.target.value)} required />
        <button className="btn btn-block form-actions" type="submit">{t('auth.login')}</button>
      </form>
      <Link to="/register">{t('auth.noAccount')}</Link>
    </div>
  );
}
