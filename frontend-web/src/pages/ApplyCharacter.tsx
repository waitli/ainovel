import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useSeo } from '../lib/seo';

export default function ApplyCharacter() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  useSeo({
    title: lang === 'zh' ? '申请角色入书 | AI Novel' : 'Apply Character | AI Novel',
    description: lang === 'zh' ? '提交角色申请，参与小说共创。' : 'Submit a character application to join co-creation.',
    lang,
    path: `/books/${id || ''}/apply-character`,
    noindex: true,
    enableHreflang: false,
  });
  const [name, setName] = useState('');
  const [appearance, setAppearance] = useState('');
  const [personality, setPersonality] = useState('');
  const [backstory, setBackstory] = useState('');
  const [motivation, setMotivation] = useState('');
  const [abilities, setAbilities] = useState('');
  const [relationship, setRelationship] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState({ show: false, text: '', type: 'success' as 'success' | 'error' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!api.getToken()) { navigate('/login'); return; }
    setSubmitting(true);
    try {
      const r = await api.applyChar(id!, {
        name, appearance, personality, backstory, motivation, abilities, relationship_to_existing: relationship,
      });
      setModal({
        show: true,
        type: 'success',
        text: `${t('applyChar.successPrefix')}${r.character_name}${t('applyChar.successSuffix')}\n\n${t('applyChar.waitApproval')}`,
      });
      setName(''); setAppearance(''); setPersonality(''); setBackstory(''); setMotivation(''); setAbilities(''); setRelationship('');
    } catch (e: any) {
      setModal({ show: true, type: 'error', text: e.message });
    } finally { setSubmitting(false); }
  };

  return (
    <>
      <Link to={`/books/${id}`} className="link-muted">{t('applyChar.back')}</Link>
      <div className="page-intro">
        <h1 className="page-title">{t('applyChar.title')}</h1>
        <p className="page-subtitle">{t('applyChar.desc')}</p>
      </div>

      {/* 弹窗 */}
      {modal.show && (
        <div className="modal-overlay" onClick={() => setModal(p => ({ ...p, show: false }))}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">{modal.type === 'success' ? '✅' : '❌'}</div>
            <p className={`modal-text ${modal.type === 'error' ? 'error' : ''}`}>{modal.text}</p>
            <button className="btn btn-block form-actions" onClick={() => setModal(p => ({ ...p, show: false }))}>{t('applyChar.confirm')}</button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-shell narrow fade-up">
        <label>{t('applyChar.name')}</label>
        <input value={name} onChange={e => setName(e.target.value)} required placeholder={t('applyChar.placeholderName')} />

        <label>{t('applyChar.appearance')}</label>
        <textarea value={appearance} onChange={e => setAppearance(e.target.value)} required rows={2} placeholder={t('applyChar.placeholderAppearance')} />

        <label>{t('applyChar.personality')}</label>
        <textarea value={personality} onChange={e => setPersonality(e.target.value)} required rows={2} placeholder={t('applyChar.placeholderPersonality')} />

        <label>{t('applyChar.backstory')}</label>
        <textarea value={backstory} onChange={e => setBackstory(e.target.value)} required rows={3} placeholder={t('applyChar.placeholderBackstory')} />

        <label>{t('applyChar.motivation')}</label>
        <input value={motivation} onChange={e => setMotivation(e.target.value)} required placeholder={t('applyChar.placeholderMotivation')} />

        <label>{t('applyChar.abilities')}</label>
        <input value={abilities} onChange={e => setAbilities(e.target.value)} placeholder={t('applyChar.placeholderAbilities')} />

        <label>{t('applyChar.relationship')}</label>
        <input value={relationship} onChange={e => setRelationship(e.target.value)} placeholder={t('applyChar.placeholderRelationship')} />

        <button type="submit" disabled={submitting} className="btn btn-block form-actions">
          {submitting ? t('applyChar.submitting') : t('applyChar.submit')}
        </button>
      </form>
    </>
  );
}
