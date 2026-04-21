import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useSeo } from '../lib/seo';

export default function Chapter() {
  const { id, num } = useParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const n = parseInt(num!);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [fontSize, setFontSize] = useState(18);

  const chapterTitle = data?.chapter?.title || (lang === 'zh' ? `第 ${n} 章` : `Chapter ${n}`);
  const seoTitle = `${chapterTitle} | AI Novel`;
  const seoDescription = lang === 'zh'
    ? `阅读第 ${n} 章，并参与下一章剧情投票。`
    : `Read chapter ${n} and vote for the next story direction.`;
  useSeo({
    title: seoTitle,
    description: seoDescription,
    lang,
    path: `/books/${id || ''}/chapters/${n}`,
  });

  useEffect(() => {
    setLoading(true);
    api.getChapter(id!, n).then(setData).catch(console.error).finally(() => setLoading(false));
    window.scrollTo(0, 0);
  }, [id, num]);

  const handleVote = async (dirId: string) => {
    if (!api.getToken()) { setMsg(t('chapter.pleaseLogin')); return; }
    try {
      const r = await api.vote(dirId);
      setMsg(r.triggered ? t('chapter.voteTriggered') : `${t('chapter.votedPrefix')}${r.current_votes}/${r.threshold}${t('chapter.votedSuffix')}`);
      const d = await api.getChapter(id!, n);
      setData(d);
    } catch (e: any) { setMsg('❌ ' + e.message); }
  };

  if (loading) return <div className="loading">{t('chapter.loading')}</div>;
  if (!data) return <div className="loading">{t('chapter.notFound')}</div>;

  const { chapter, content, directions } = data;

  // 正文 — 去掉markdown标题，保留段落结构
  const rawContent = (content || '')
    .replace(/\r\n/g, '\n')
    .replace(/^# .+?\n+/, '')        // 去掉开头的markdown标题（中英文都匹配）
    .replace(/\n{3,}/g, '\n\n')      // 最多两个换行
    .trim();

  // 按空行分段
  const paragraphs = rawContent
    .split(/\n\n+/)
    .map((p: string) => p.replace(/\n/g, '').trim())
    .filter((p: string) => p.length > 0);

  return (
    <div className="reader-container fade-up">
      {/* 顶部导航栏 */}
      <div className="reader-topbar">
        <Link to={`/books/${id}`} className="link-muted">{t('chapter.backToc')}</Link>
        <span className="reader-current">{chapter.title}</span>
        <div className="reader-font">
          <button className="reader-font-btn" onClick={() => setFontSize(f => Math.max(14, f - 2))}>A-</button>
          <span className="reader-font-value">{fontSize}px</span>
          <button className="reader-font-btn" onClick={() => setFontSize(f => Math.min(28, f + 2))}>A+</button>
        </div>
      </div>

      {/* 章节信息 */}
      <div className="reader-header">
        <h1 className="reader-title">{chapter.title}</h1>
        <div className="reader-meta">
          <span>{chapter.word_count}{t('chapter.wordsSuffix')}</span>
          {chapter.published_at && <span>· {new Date(chapter.published_at * 1000).toLocaleDateString()}</span>}
        </div>
      </div>

      {/* 正文 */}
      <div className="reader-content">
        {paragraphs.map((p: string, i: number) => (
          <p key={i} className="reader-paragraph" style={{ fontSize, lineHeight: '1.85' }}>{p}</p>
        ))}
      </div>

      {/* 章节底部导航 */}
      <div className="reader-bottom-nav">
        {n > 1 ? (
          <Link to={`/books/${id}/chapters/${n - 1}`} className="reader-nav-btn">
            {t('chapter.prevChapter')}
          </Link>
        ) : <div />}

        <Link to={`/books/${id}`} className="reader-nav-center">
          {t('chapter.toc')}
        </Link>

        <Link to={`/books/${id}/chapters/${n + 1}`} className="reader-nav-btn next">
          {t('chapter.nextChapter')}
        </Link>
      </div>

      {/* 方向投票 */}
      {directions?.length > 0 && (
        <div className="vote-section">
          <div className="vote-header">
            <span className="vote-icon">🗳️</span>
            <span>{t('chapter.voteSection')}</span>
          </div>
          {msg && <div className={msg.startsWith('❌') ? 'error-msg' : 'success-msg'}>{msg}</div>}
          {directions.map((d: any, i: number) => (
            <div
              key={d.id}
              className={`vote-card ${d.status === 'won' ? 'is-won' : ''} ${d.status === 'voting' ? 'is-voting' : ''}`}
              onClick={() => d.status === 'voting' && handleVote(d.id)}
            >
              <div className="vote-card-header">
                <span className="vote-card-num">{t('chapter.directionPrefix')} {String.fromCharCode(65 + i)}</span>
                {d.status === 'voting' && <span className="vote-card-tag voting">🗳️ {d.vote_count}{t('chapter.voteSuffix')}</span>}
                {d.status === 'won' && <span className="vote-card-tag won">{t('chapter.adopted')}</span>}
              </div>
              <div className="vote-card-title">{d.title}</div>
              <div className="vote-card-desc">{d.description}</div>
            </div>
          ))}
        </div>
      )}

      {/* 底部间距 */}
      <div className="reader-spacer" />
    </div>
  );
}
