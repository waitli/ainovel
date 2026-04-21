import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useSeo } from '../lib/seo';

// 首字封面 (根据书名首字 + 类型配色)
const COVERS: Record<string, { bg: string }> = {
  '玄幻': { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  '仙侠': { bg: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  '科幻': { bg: 'linear-gradient(135deg, #0c3483 0%, #a2b6df 100%)' },
  '都市': { bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  '历史': { bg: 'linear-gradient(135deg, #c79081 0%, #dfa579 100%)' },
  '武侠': { bg: 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)' },
  '悬疑': { bg: 'linear-gradient(135deg, #434343 0%, #1a1a2e 100%)' },
  '奇幻': { bg: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  '言情': { bg: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)' },
  'Fantasy': { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  'Sci-Fi': { bg: 'linear-gradient(135deg, #0c3483 0%, #a2b6df 100%)' },
  'Romance': { bg: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)' },
  'Thriller': { bg: 'linear-gradient(135deg, #434343 0%, #1a1a2e 100%)' },
};
const DEFAULT_COVER = { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' };

function formatWords(n: number, lang: string): string {
  if (lang === 'zh') {
    return n > 10000 ? Math.round(n / 10000) + '万' : String(n);
  }
  return n > 1000 ? Math.round(n / 1000) + 'k' : String(n);
}

// 截取简介
function excerpt(text: string | null | undefined, maxLen: number): string {
  if (!text) return '';
  const clean = text.replace(/\n/g, ' ').trim();
  return clean.length > maxLen ? clean.slice(0, maxLen) + '...' : clean;
}

export default function Home() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [hotBooks, setHotBooks] = useState<any[]>([]);
  const [latestBooks, setLatestBooks] = useState<any[]>([]);
  const [statBooks, setStatBooks] = useState<any[]>([]);
  const [coverErrorMap, setCoverErrorMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const seoTitle = lang === 'zh'
    ? 'AI Novel 平台 | 热榜与最新连载'
    : 'AI Novel Platform | Hot Rankings & Latest Serials';
  const seoDescription = lang === 'zh'
    ? `读者投票驱动的 AI 小说平台。当前连载 ${statBooks.length} 本，持续更新章节。`
    : `Reader-driven AI novel platform. ${statBooks.length} active serials with continuously updated chapters.`;
  useSeo({ title: seoTitle, description: seoDescription, lang, path: '/' });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.getBooks({ status: 'active', sort: 'hot', limit: 10 }),
      api.getBooks({ status: 'active', sort: 'updated_at', limit: 50 }),
    ])
      .then(([hotRes, latestRes]) => {
        if (cancelled) return;
        const hot = hotRes.books || [];
        const pool = latestRes.books || [];

        setHotBooks(hot.slice(0, 10));
        setLatestBooks(pool.slice(0, 16));
        setStatBooks(pool);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [lang]);

  const renderBookCard = (b: any, keyPrefix = '') => {
    const cover = COVERS[b.genre] || DEFAULT_COVER;
    const coverFailed = !!coverErrorMap[b.id];
    return (
      <Link to={`/books/${b.id}`} key={`${keyPrefix}${b.id}`} className="book-card">
        <div className="book-cover" style={{ background: cover.bg }}>
          {!coverFailed && (
            <img
              src={api.getCoverUrl(b.id)}
              alt={b.title}
              className="book-cover-img"
              loading="lazy"
              onError={() => setCoverErrorMap((prev) => ({ ...prev, [b.id]: true }))}
            />
          )}
          <span className="book-cover-initial">{b.title.charAt(0)}</span>
          <div className="book-cover-gradient" />
        </div>
        <div className="book-body">
          <div className="book-title">{b.title}</div>
          <div className="book-meta">
            <span className="tag tag-genre">{b.genre}</span>
            <span className="book-meta-text">{b.current_chapter}{t('home.chaptersSuffix')}</span>
          </div>
          <div className="book-synopsis">{excerpt(b.synopsis, 70) || excerpt(b.synopsis, 40)}</div>
        </div>
        <div className="book-footer">
          <span className="book-footer-item">🔥 {b.current_chapter || 0}{t('home.chaptersSuffix')}</span>
          <span className="book-footer-item">📄 {formatWords(b.total_words || 0, lang)}{t('home.wordsSuffix')}</span>
        </div>
      </Link>
    );
  };

  return (
    <>
      {/* Hero */}
      <div className="hero">
        <h1>📖 AI Novel Platform</h1>
        <p>{t('home.subtitle')}</p>
        <div className="hero-stats">
          <div className="hero-stat">
            <div className="hero-stat-num">{statBooks.length}</div>
            <div className="hero-stat-label">{t('home.ongoing')}</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-num">{statBooks.reduce((s, b) => s + (b.current_chapter || 0), 0)}</div>
            <div className="hero-stat-label">{t('home.totalChapters')}</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-num">{formatWords(statBooks.reduce((s, b) => s + (b.total_words || 0), 0), lang)}</div>
            <div className="hero-stat-label">{t('home.totalWords')}</div>
          </div>
        </div>
      </div>

      {/* 热度排行榜 */}
      {hotBooks.length > 0 && (
        <div className="ranking">
          <div className="ranking-header">{t('home.hotRanking')}</div>
          <div className="ranking-list">
            {hotBooks.map((b, i) => (
              <Link to={`/books/${b.id}`} key={b.id} className="ranking-item">
                <div className={`ranking-num ${i < 3 ? `ranking-num-${i + 1}` : 'ranking-num-other'}`}>{i + 1}</div>
                <div className="ranking-info">
                  <div className="ranking-title">{b.title}</div>
                  {b.synopsis && <div className="ranking-synopsis">{excerpt(b.synopsis, 50)}</div>}
                  <div className="ranking-meta">{b.genre} · {b.current_chapter}{t('home.chaptersSuffix')} · {formatWords(b.total_words || 0, lang)}{t('home.wordsSuffix')}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 小说列表 */}
      <div className="section-header">
        <div className="section-title">{t('home.latestSerials')}</div>
      </div>

      {loading ? (
        <p className="loading">{t('common.loading')}</p>
      ) : latestBooks.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📖</div>
          <p className="text">{t('home.emptyText')}</p>
          <Link to="/submit" className="btn">{t('home.startSubmit')}</Link>
        </div>
      ) : (
        <div className="book-grid">
          {latestBooks.map((b) => renderBookCard(b, 'latest-'))}
        </div>
      )}
    </>
  );
}
