import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useSeo } from '../lib/seo';

type Tab = 'dashboard' | 'books' | 'characters' | 'users' | 'management';
type BookReviewView = 'pending' | 'history';

interface Stats {
  totalBooks: number;
  pendingSubmissions: number;
  totalUsers: number;
  totalChapters: number;
  totalWords: number;
  pendingCharApps: number;
}

export default function Admin() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  useSeo({
    title: lang === 'zh' ? '管理后台 | AI Novel' : 'Admin Dashboard | AI Novel',
    description: lang === 'zh' ? 'AI Novel 管理后台。' : 'AI Novel administration dashboard.',
    lang,
    path: '/admin',
    noindex: true,
    enableHreflang: false,
  });
  const [tab, setTab] = useState<Tab>('dashboard');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');
  const [bookReviewView, setBookReviewView] = useState<BookReviewView>('pending');

  const [pendingSubs, setPendingSubs] = useState<any[]>([]);
  const [reviewedSubs, setReviewedSubs] = useState<any[]>([]);
  const [pendingChars, setPendingChars] = useState<any[]>([]);
  const [allBooks, setAllBooks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalBooks: 0,
    pendingSubmissions: 0,
    totalUsers: 0,
    totalChapters: 0,
    totalWords: 0,
    pendingCharApps: 0,
  });
  const [loading, setLoading] = useState(false);

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(''), 4000);
  };

  const parseJSON = (raw?: any) => {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const getSubmissionTheme = (book: any) => {
    const data = parseJSON(book.submission_data);
    return book.theme || data?.worldview || data?.outline || data?.core_conflict || '';
  };

  const formatAt = (unix?: number) => (unix ? new Date(unix * 1000).toLocaleString() : '—');

  const loadStats = async () => {
    try {
      const [pendingRes, approvedRes, activeRes] = await Promise.all([
        api.getSubmissions('pending').catch(() => ({ books: [] })),
        api.getSubmissions('approved').catch(() => ({ books: [] })),
        api.getBooks({ status: 'active', lang: '', limit: 100 }).catch(() => ({ books: [] })),
      ]);

      const pending = pendingRes.books || [];
      const approved = approvedRes.books || [];
      const active = activeRes.books || [];
      const totalBooks = pending.length + approved.length + active.length;
      const totalChapters = active.reduce((s: number, b: any) => s + (b.current_chapter || 0), 0);
      const totalWords = active.reduce((s: number, b: any) => s + (b.total_words || 0), 0);

      setStats((s) => ({
        ...s,
        totalBooks,
        totalChapters,
        totalWords,
        pendingSubmissions: pending.length,
        pendingCharApps: 0,
      }));
    } catch {
      // ignore
    }
  };

  const loadPendingSubs = async () => {
    setLoading(true);
    try {
      const d = await api.getSubmissions('pending');
      setPendingSubs(d.books || []);
    } catch (e: any) {
      showMsg(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadReviewedSubs = async () => {
    setLoading(true);
    try {
      const [approved, active] = await Promise.all([
        api.getSubmissions('approved').catch(() => ({ books: [] })),
        api.getSubmissions('active').catch(() => ({ books: [] })),
      ]);

      const merged = [...(approved.books || []), ...(active.books || [])];
      merged.sort((a: any, b: any) => {
        const ta = a.approved_at || a.updated_at || a.created_at || 0;
        const tb = b.approved_at || b.updated_at || b.created_at || 0;
        return tb - ta;
      });
      setReviewedSubs(merged);
    } catch (e: any) {
      showMsg(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadPendingChars = async () => {
    setLoading(true);
    try {
      const d = await api.getSubmissions('approved');
      const books = d.books || [];
      const apps: any[] = [];
      await Promise.all(
        books.map(async (b: any) => {
          try {
            const ca = await api.getCharApps(b.id, 'pending');
            if (ca.applications) {
              ca.applications.forEach((a: any) => {
                a._bookTitle = b.title;
                a._bookId = b.id;
              });
              apps.push(...ca.applications);
            }
          } catch {
            // skip
          }
        }),
      );
      setPendingChars(apps);
    } catch (e: any) {
      showMsg(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAllBooks = async () => {
    setLoading(true);
    try {
      const [active, approved, pending] = await Promise.all([
        api.getBooks({ status: 'active', lang: '', limit: 100 }).catch(() => ({ books: [] })),
        api.getSubmissions('approved').catch(() => ({ books: [] })),
        api.getSubmissions('pending').catch(() => ({ books: [] })),
      ]);
      setAllBooks([...(active.books || []), ...(approved.books || []), ...(pending.books || [])]);
    } catch (e: any) {
      showMsg(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const d = await api.getUsers();
      setUsers(d.users || []);
      setStats((s) => ({ ...s, totalUsers: (d.users || []).length }));
    } catch (e: any) {
      showMsg(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    if (tab === 'books') {
      if (bookReviewView === 'pending') loadPendingSubs();
      else loadReviewedSubs();
    }
    if (tab === 'characters') loadPendingChars();
    if (tab === 'management') loadAllBooks();
    if (tab === 'users') loadUsers();
  }, [tab, bookReviewView]);

  const approveBook = async (id: string) => {
    try {
      await api.approve(id);
      showMsg(t('admin.approved'));
      if (bookReviewView === 'pending') loadPendingSubs();
      else loadReviewedSubs();
      loadStats();
    } catch (e: any) {
      showMsg(e.message, 'error');
    }
  };

  const rejectBook = async (id: string) => {
    try {
      await api.reject(id, rejectReason || undefined);
      showMsg(t('admin.rejectedMsg'));
      setRejectingId(null);
      setRejectReason('');
      if (bookReviewView === 'pending') loadPendingSubs();
      else loadReviewedSubs();
      loadStats();
    } catch (e: any) {
      showMsg(e.message, 'error');
    }
  };

  const approveCharacter = async (id: string) => {
    try {
      await api.approveChar(id);
      showMsg(t('admin.approved'));
      loadPendingChars();
      loadStats();
    } catch (e: any) {
      showMsg(e.message, 'error');
    }
  };

  const rejectCharacter = async (id: string) => {
    try {
      await api.rejectChar(id, rejectReason || undefined);
      showMsg(t('admin.rejectedMsg'));
      setRejectingId(null);
      setRejectReason('');
      loadPendingChars();
      loadStats();
    } catch (e: any) {
      showMsg(e.message, 'error');
    }
  };

  const deleteBook = async (id: string) => {
    try {
      await api.deleteBook(id);
      showMsg(t('admin.deleted'));
      setDeletingId(null);
      loadAllBooks();
      loadStats();
    } catch (e: any) {
      showMsg(e.message, 'error');
    }
  };

  const toggleRole = async (u: any) => {
    const newRole = u.role === 'admin' ? 'reader' : 'admin';
    try {
      await api.updateUserRole(u.id, newRole);
      showMsg(t('admin.roleUpdated'));
      loadUsers();
    } catch (e: any) {
      showMsg(e.message, 'error');
    }
  };

  const riskClass: Record<string, string> = {
    low: 'admin-risk-low',
    medium: 'admin-risk-medium',
    high: 'admin-risk-high',
  };

  const getSuggestionText = (s: string) => {
    if (s === 'approve') return t('admin.suggestApprove');
    if (s === 'review') return t('admin.suggestReview');
    return t('admin.suggestReject');
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: t('admin.tabDashboard') },
    { key: 'books', label: t('admin.tabBookApproval') },
    { key: 'characters', label: t('admin.tabCharApproval') },
    { key: 'management', label: t('admin.tabBooks') },
    { key: 'users', label: t('admin.tabUsers') },
  ];

  return (
    <>
      <div className="page-intro">
        <h1 className="page-title">{t('admin.title')}</h1>
      </div>

      <div className="tabs admin-tabs">
        {tabs.map((tb) => (
          <button key={tb.key} className={`tab ${tab === tb.key ? 'active' : ''}`} onClick={() => setTab(tb.key)}>
            {tb.label}
            {tb.key === 'books' && stats.pendingSubmissions > 0 && (
              <span className="tag tag-red tab-badge">{stats.pendingSubmissions}</span>
            )}
            {tb.key === 'characters' && stats.pendingCharApps > 0 && (
              <span className="tag tag-red tab-badge">{stats.pendingCharApps}</span>
            )}
          </button>
        ))}
      </div>

      {msg && <p className={msgType === 'success' ? 'success-msg' : 'error-msg'}>{msg}</p>}

      {tab === 'dashboard' && (
        <div className="admin-stats-grid fade-up">
          {[
            { icon: '📚', label: t('admin.totalBooks'), value: stats.totalBooks.toLocaleString() },
            { icon: '⏳', label: t('admin.pendingSubmissions'), value: stats.pendingSubmissions.toLocaleString() },
            { icon: '🎭', label: t('admin.pendingCharApps'), value: stats.pendingCharApps.toLocaleString() },
            { icon: '👥', label: t('admin.totalUsers'), value: stats.totalUsers.toLocaleString() },
            { icon: '📖', label: t('admin.totalChapters'), value: stats.totalChapters.toLocaleString() },
            { icon: '📝', label: t('admin.words'), value: stats.totalWords.toLocaleString() },
          ].map((s) => (
            <div key={s.label} className="card admin-stat-card">
              <div className="admin-stat-icon">{s.icon}</div>
              <div className="admin-stat-value">{s.value}</div>
              <div className="admin-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'books' && (
        <>
          <div className="admin-book-subtabs">
            <button
              className={`admin-book-subtab ${bookReviewView === 'pending' ? 'active' : ''}`}
              onClick={() => setBookReviewView('pending')}
            >
              {t('admin.bookReviewPending')}
              <span className="tag tag-red tab-badge">{stats.pendingSubmissions}</span>
            </button>
            <button
              className={`admin-book-subtab ${bookReviewView === 'history' ? 'active' : ''}`}
              onClick={() => setBookReviewView('history')}
            >
              {t('admin.bookReviewHistory')}
            </button>
          </div>

          {loading ? (
            <p className="loading">{t('common.loading')}</p>
          ) : bookReviewView === 'pending' ? (
            pendingSubs.length === 0 ? (
              <div className="empty-state admin-empty fade-up">
                <div className="icon">✨</div>
                <p className="text">{t('admin.noPending')}</p>
              </div>
            ) : (
              <div className="admin-list fade-up">
                {pendingSubs.map((s) => {
                  const ai: any = parseJSON(s.ai_review) || {};
                  const theme = getSubmissionTheme(s);

                  return (
                    <div key={s.id} className="card admin-item">
                      <div className="admin-item-head">
                        <div>
                          <h3 className="admin-item-title">{s.title}</h3>
                          <span className="tag tag-genre">{s.genre}</span>
                        </div>
                        <span className="tag tag-gold">{t('admin.pending')}</span>
                      </div>

                      {theme && <p className="admin-item-summary">{theme}</p>}

                      {ai.suggestion && (
                        <div className="ai-box">
                          <div className="ai-label">{t('admin.aiReview')}</div>
                          <div className="admin-ai-meta">
                            <span className={`ai-risk ${riskClass[ai.risk_level] || ''}`}>{ai.risk_level?.toUpperCase()}</span>
                            <span className="admin-ai-suggestion">
                              {t('admin.suggestPrefix')} {getSuggestionText(ai.suggestion)}
                            </span>
                          </div>
                          {ai.reason && <div className="ai-reason">{ai.reason}</div>}
                          {ai.categories?.length > 0 && (
                            <div className="admin-ai-categories">
                              {ai.categories.map((c: string) => (
                                <span key={c} className="tag tag-red">
                                  {c}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="actions">
                        <button className="btn btn-green btn-sm" onClick={() => approveBook(s.id)}>
                          {t('admin.approve')}
                        </button>
                        {rejectingId === s.id ? (
                          <div className="admin-reject-box">
                            <input
                              type="text"
                              placeholder={t('admin.rejectReasonPlaceholder')}
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              className="admin-reject-input"
                            />
                            <button className="btn btn-red btn-sm" onClick={() => rejectBook(s.id)}>
                              {t('admin.reject')}
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => {
                                setRejectingId(null);
                                setRejectReason('');
                              }}
                            >
                              {t('common.back')}
                            </button>
                          </div>
                        ) : (
                          <button className="btn btn-red btn-sm" onClick={() => setRejectingId(s.id)}>
                            {t('admin.reject')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : reviewedSubs.length === 0 ? (
            <div className="empty-state admin-empty fade-up">
              <div className="icon">📚</div>
              <p className="text">{t('admin.noApprovedHistory')}</p>
            </div>
          ) : (
            <div className="admin-list fade-up">
              {reviewedSubs.map((s) => {
                const ai: any = parseJSON(s.ai_review) || {};
                const submissionData: any = parseJSON(s.submission_data) || {};
                const theme = getSubmissionTheme(s);
                const statusLabel = s.status === 'active' ? t('admin.statusActive') : t('admin.statusApproved');
                return (
                  <div key={s.id} className="card admin-item">
                    <div className="admin-item-head">
                      <div>
                        <h3 className="admin-item-title">{s.title}</h3>
                        <span className="tag tag-genre">{s.genre}</span>
                      </div>
                      <span className={`tag ${s.status === 'active' ? 'tag-green' : 'tag-blue'}`}>{statusLabel}</span>
                    </div>

                    <div className="admin-item-meta">
                      <span>{t('admin.reviewTime')}: {formatAt(s.approved_at || s.updated_at)}</span>
                      <span>{t('admin.language')}: {s.language || '—'}</span>
                      {s.status === 'active' && <span>{t('admin.chapters')}: {s.current_chapter || 0}</span>}
                      {s.status === 'active' && <span>{t('admin.words')}: {(s.total_words || 0).toLocaleString()}</span>}
                    </div>

                    {theme && <p className="admin-item-summary">{theme}</p>}
                    {submissionData.tone && <p className="admin-item-note">✍️ {submissionData.tone}</p>}

                    {ai.suggestion && (
                      <div className="ai-box">
                        <div className="ai-label">{t('admin.aiReview')}</div>
                        <div className="admin-ai-meta">
                          <span className={`ai-risk ${riskClass[ai.risk_level] || ''}`}>{ai.risk_level?.toUpperCase()}</span>
                          <span className="admin-ai-suggestion">
                            {t('admin.suggestPrefix')} {getSuggestionText(ai.suggestion)}
                          </span>
                        </div>
                        {ai.reason && <div className="ai-reason">{ai.reason}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'characters' &&
        (loading ? (
          <p className="loading">{t('common.loading')}</p>
        ) : pendingChars.length === 0 ? (
          <div className="empty-state admin-empty fade-up">
            <div className="icon">🎭</div>
            <p className="text">{t('admin.noCharPending')}</p>
          </div>
        ) : (
          <div className="admin-list fade-up">
            {pendingChars.map((c) => (
              <div key={c.id} className="card admin-item">
                <div className="admin-item-head">
                  <div>
                    <h3 className="admin-item-title">{c.name}</h3>
                    <span className="tag tag-blue">{c._bookTitle || t('admin.charBook')}</span>
                  </div>
                  <span className="tag tag-gold">{t('admin.pending')}</span>
                </div>

                <div className="admin-item-fields">
                  {c.appearance && (
                    <div>
                      <strong className="admin-field-label">{t('admin.charAppearance')}:</strong>
                      <p className="admin-field-text">{c.appearance}</p>
                    </div>
                  )}
                  {c.personality && (
                    <div>
                      <strong className="admin-field-label">{t('admin.charPersonality')}:</strong>
                      <p className="admin-field-text">{c.personality}</p>
                    </div>
                  )}
                  {c.backstory && (
                    <div>
                      <strong className="admin-field-label">{t('admin.charBackstory')}:</strong>
                      <p className="admin-field-text long">{c.backstory}</p>
                    </div>
                  )}
                </div>

                <div className="actions">
                  <button className="btn btn-green btn-sm" onClick={() => approveCharacter(c.id)}>
                    {t('admin.approve')}
                  </button>
                  {rejectingId === c.id ? (
                    <div className="admin-reject-box">
                      <input
                        type="text"
                        placeholder={t('admin.rejectReasonPlaceholder')}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="admin-reject-input"
                      />
                      <button className="btn btn-red btn-sm" onClick={() => rejectCharacter(c.id)}>
                        {t('admin.reject')}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason('');
                        }}
                      >
                        {t('common.back')}
                      </button>
                    </div>
                  ) : (
                    <button className="btn btn-red btn-sm" onClick={() => setRejectingId(c.id)}>
                      {t('admin.reject')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}

      {tab === 'management' &&
        (loading ? (
          <p className="loading">{t('common.loading')}</p>
        ) : allBooks.length === 0 ? (
          <div className="empty-state admin-empty fade-up">
            <div className="icon">📚</div>
            <p className="text">{t('admin.noBooks')}</p>
          </div>
        ) : (
          <div className="card admin-table-wrap fade-up">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="admin-th">{t('admin.bookTitle')}</th>
                  <th className="admin-th">{t('admin.genre')}</th>
                  <th className="admin-th">{t('admin.language')}</th>
                  <th className="admin-th right">{t('admin.chapters')}</th>
                  <th className="admin-th right">{t('admin.words')}</th>
                  <th className="admin-th right">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {allBooks.map((b) => (
                  <tr key={b.id}>
                    <td className="admin-td strong">{b.title}</td>
                    <td className="admin-td">
                      <span className="tag tag-genre">{b.genre}</span>
                    </td>
                    <td className="admin-td muted">{b.language || '—'}</td>
                    <td className="admin-td right">{b.current_chapter || 0}</td>
                    <td className="admin-td right">{b.total_words ? b.total_words.toLocaleString() : '—'}</td>
                    <td className="admin-td right">
                      {deletingId === b.id ? (
                        <div className="admin-row-actions">
                          <span className="admin-warn-text">{t('admin.deleteConfirm')}</span>
                          <button className="btn btn-red btn-sm" onClick={() => deleteBook(b.id)}>
                            {t('admin.delete')}
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setDeletingId(null)}>
                            {t('common.back')}
                          </button>
                        </div>
                      ) : (
                        <button className="btn btn-red btn-sm" onClick={() => setDeletingId(b.id)}>
                          {t('admin.delete')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === 'users' &&
        (loading ? (
          <p className="loading">{t('common.loading')}</p>
        ) : users.length === 0 ? (
          <div className="empty-state admin-empty fade-up">
            <div className="icon">👥</div>
            <p className="text">{t('admin.noUsers')}</p>
          </div>
        ) : (
          <div className="card admin-table-wrap fade-up">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="admin-th">{t('admin.username')}</th>
                  <th className="admin-th">{t('admin.email')}</th>
                  <th className="admin-th">{t('admin.role')}</th>
                  <th className="admin-th">{t('admin.registered')}</th>
                  <th className="admin-th right">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="admin-td strong">{u.username}</td>
                    <td className="admin-td muted">{u.email}</td>
                    <td className="admin-td">
                      <span className={`tag ${u.role === 'admin' ? 'tag-green' : 'tag-blue'}`}>
                        {u.role === 'admin' ? t('admin.roleAdmin') : t('admin.roleReader')}
                      </span>
                    </td>
                    <td className="admin-td muted">
                      {u.created_at ? new Date(u.created_at * 1000).toLocaleDateString() : '—'}
                    </td>
                    <td className="admin-td right nowrap">
                      <div className="admin-row-actions">
                        <button
                          className={`btn btn-sm ${u.role === 'admin' ? 'btn-ghost' : 'btn-green'}`}
                          onClick={() => toggleRole(u)}
                        >
                          {u.role === 'admin' ? t('admin.roleReader') : t('admin.roleAdmin')}
                        </button>
                        <button
                          className="btn btn-sm btn-red"
                          onClick={() => {
                            if (confirm(`${t('admin.confirmDeleteUser')} ${u.username}?`)) {
                              api
                                .deleteUser(u.id)
                                .then(() => {
                                  showMsg(t('admin.userDeleted'));
                                  loadUsers();
                                })
                                .catch((e: any) => showMsg(e.message, 'error'));
                            }
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </>
  );
}
