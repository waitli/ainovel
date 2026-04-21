import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useSeo } from '../lib/seo';

const COVERS: Record<string, { bg: string; emoji: string }> = {
  '玄幻': { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', emoji: '⚔️' },
  '仙侠': { bg: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', emoji: '🏔️' },
  '科幻': { bg: 'linear-gradient(135deg, #0c3483 0%, #a2b6df 100%)', emoji: '🚀' },
  '都市': { bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', emoji: '🏙️' },
  'Fantasy': { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', emoji: '⚔️' },
  'Sci-Fi': { bg: 'linear-gradient(135deg, #0c3483 0%, #a2b6df 100%)', emoji: '🚀' },
};

export default function BookDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [book, setBook] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [coverFailed, setCoverFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  const seoTitle = book?.title
    ? `${book.title} | AI Novel`
    : (lang === 'zh' ? '小说详情 | AI Novel' : 'Book Detail | AI Novel');
  const seoDescription = book?.synopsis
    ? String(book.synopsis)
    : (lang === 'zh' ? '查看小说详情、目录与最新章节。' : 'View novel details, table of contents, and latest chapters.');
  useSeo({
    title: seoTitle,
    description: seoDescription,
    lang,
    path: `/books/${id || ''}`,
  });

  useEffect(() => {
    setCoverFailed(false);
    Promise.all([api.getBook(id!), api.getChapters(id!)])
      .then(([b, c]) => { setBook(b); setChapters(c.chapters || []); })
      .catch(console.error).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="loading">{t('common.loading')}</p>;
  if (!book) return <p className="error-msg">{t('common.bookNotFound')}</p>;

  const cover = COVERS[book.genre] || { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', emoji: '📖' };
  const words = book.total_words ? Math.round(book.total_words / 1000) + 'k' : '0';

  return (
    <>
      <Link to="/" className="link-muted">{t('book.backHome')}</Link>

      {/* 书目头部 */}
      <div className="detail-hero fade-up">
        <div className="detail-cover" style={{ background: cover.bg }}>
          {!coverFailed && (
            <img
              src={api.getCoverUrl(book.id)}
              alt={book.title}
              className="detail-cover-img"
              onError={() => setCoverFailed(true)}
            />
          )}
          <span className="detail-cover-initial">{book.title.charAt(0)}</span>
        </div>
        <div>
          <h1 className="detail-title">{book.title}</h1>
          <div className="detail-meta">
            <span className="tag tag-genre">{book.genre}</span>
            <span className="tag tag-blue">{book.current_chapter} {t('book.chaptersCount')}</span>
            <span className="tag tag-pink">{lang === 'zh' ? words + t('book.wordsCount') : words + ' ' + t('book.wordsCount')}</span>
          </div>
          {book.synopsis && <p className="detail-synopsis">{book.synopsis}</p>}
          <div className="detail-actions">
            {chapters.length > 0 && (
              <Link to={`/books/${id}/chapters/${chapters[0].chapter_number}`} className="btn">
                {t('book.startRead')}
              </Link>
            )}
            <Link to={`/books/${id}/apply-character`} className="btn btn-ghost">{t('book.applyCharBtn')}</Link>
          </div>
        </div>
      </div>

      {/* 目录 */}
      <div className="section-header">
        <div className="section-title">{t('book.toc')}</div>
        <span className="section-meta">{chapters.length} {t('book.chaptersCount')}</span>
      </div>
      <ul className="chapter-list">
        {chapters.map(ch => (
          <li key={ch.chapter_number}>
            <Link to={`/books/${id}/chapters/${ch.chapter_number}`}>{ch.title}</Link>
            <small>{ch.word_count}{t('book.wordsCount')}</small>
          </li>
        ))}
      </ul>
    </>
  );
}
