import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useUser } from '../lib/user-context';
import { useSeo } from '../lib/seo';

export default function Register() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  useSeo({
    title: lang === 'zh' ? '注册 | AI Novel' : 'Register | AI Novel',
    description: lang === 'zh' ? '注册账号并加入 AI 小说共创。' : 'Create an account and join AI novel co-creation.',
    lang,
    path: '/register',
    noindex: true,
    enableHreflang: false,
  });
  const navigate = useNavigate();
  const { setUser } = useUser();
  const [step, setStep] = useState(1); // 1=enter email, 2=enter code+details
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const handleSendCode = async () => {
    if (!email) { setError('Please enter your email'); return; }
    setError('');
    setSending(true);
    try {
      await api.sendCode(email);
      setStep(2);
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown(c => { if (c <= 1) { clearInterval(timer); return 0; } return c - 1; });
      }, 1000);
    } catch (e: any) { setError(e.message); }
    finally { setSending(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const d = await api.register(username, email, password, code);
      setUser(d.user);
      navigate('/');
    } catch (e: any) { setError(e.message); }
  };

  return (
    <div className="auth-page">
      <div className="auth-icon">✨</div>
      <h1>{t('auth.startCreate')}</h1>
      <p className="subtitle">{t('auth.registerSubtitle')}</p>

      {step === 1 ? (
        <div>
          {error && <p className="error-msg">{error}</p>}
          <label>{t('auth.email')}</label>
          <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          <button className="btn btn-block form-actions" onClick={handleSendCode} disabled={sending}>
            {sending ? '⏳ Sending...' : '📧 Send Verification Code'}
          </button>
        </div>
      ) : (
        <form onSubmit={handleRegister}>
          {error && <p className="error-msg">{error}</p>}
          <p className="success-inline">✅ Code sent to {email}</p>
          <input placeholder={t('auth.username')} value={username} onChange={e => setUsername(e.target.value)} required autoComplete="username" />
          <input type="password" placeholder={t('auth.passwordMin')} value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
          <input placeholder={t('auth.verificationCode')} value={code} onChange={e => setCode(e.target.value)} required maxLength={6} autoComplete="one-time-code" />
          <div className="form-actions-split">
            <button className="btn btn-ghost" type="button" onClick={() => setStep(1)}>← Back</button>
            <button className="btn" type="submit">
              {t('auth.register')}
            </button>
          </div>
          {countdown > 0 ? (
            <p className="resend-text">{t('auth.resendIn')} {countdown}s</p>
          ) : (
            <button type="button" onClick={handleSendCode} className="resend-btn">
              {t('auth.resendCode')}
            </button>
          )}
        </form>
      )}
      <Link to="/login">{t('auth.hasAccount')}</Link>
    </div>
  );
}
