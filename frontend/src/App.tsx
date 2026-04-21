import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { api } from './lib/api';

// ---- 页面组件 ----

function HomePage() {
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getBooks({ status: 'active' })
      .then(data => setBooks(data.books || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <h1>AI 小说创作平台</h1>
      <p>由读者投票驱动的 AI 小说创作，每一章都是集体智慧的结晶</p>

      <section>
        <h2>最新连载</h2>
        {loading ? (
          <p>加载中...</p>
        ) : books.length === 0 ? (
          <p>暂无连载中的小说，去投稿创建第一本吧！</p>
        ) : (
          <div className="book-grid">
            {books.map((book: any) => (
              <Link to={`/books/${book.id}`} key={book.id} className="book-card">
                <h3>{book.title}</h3>
                <span className="genre-tag">{book.genre}</span>
                <p>{book.synopsis || '精彩内容即将展开...'}</p>
                <small>已更新 {book.current_chapter} 章</small>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="page auth-page">
      <h1>登录</h1>
      <form onSubmit={handleLogin}>
        {error && <p className="error">{error}</p>}
        <input type="email" placeholder="邮箱" value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="submit">登录</button>
      </form>
      <p>还没有账号？<Link to="/register">注册</Link></p>
    </div>
  );
}

function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.register(username, email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="page auth-page">
      <h1>注册</h1>
      <form onSubmit={handleRegister}>
        {error && <p className="error">{error}</p>}
        <input type="text" placeholder="用户名" value={username} onChange={e => setUsername(e.target.value)} required />
        <input type="email" placeholder="邮箱" value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="密码(至少6位)" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
        <button type="submit">注册</button>
      </form>
      <p>已有账号？<Link to="/login">登录</Link></p>
    </div>
  );
}

function SubmitPage() {
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('玄幻');
  const [worldview, setWorldview] = useState('');
  const [outline, setOutline] = useState('');
  const [conflict, setConflict] = useState('');
  const [tone, setTone] = useState('');
  const [charName, setCharName] = useState('');
  const [charRole, setCharRole] = useState('protagonist');
  const [charAppearance, setCharAppearance] = useState('');
  const [charPersonality, setCharPersonality] = useState('');
  const [charMotivation, setCharMotivation] = useState('');
  const [charBackstory, setCharBackstory] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await api.submitBook({
        title,
        genre,
        worldview,
        outline,
        core_conflict: conflict,
        tone,
        characters: [{
          name: charName,
          role: charRole,
          appearance: charAppearance,
          personality: charPersonality,
          motivation: charMotivation,
          backstory: charBackstory,
        }],
      });
      setSuccess(`投稿成功！等待管理员审批。ID: ${result.id}`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <h1>投稿创建新书</h1>
      <form onSubmit={handleSubmit} className="submission-form">
        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}

        <fieldset>
          <legend>基本信息</legend>
          <input type="text" placeholder="书名" value={title} onChange={e => setTitle(e.target.value)} required />
          <select value={genre} onChange={e => setGenre(e.target.value)}>
            {['玄幻','仙侠','科幻','都市','历史','武侠','悬疑','奇幻','言情','军事','游戏','其他'].map(g =>
              <option key={g} value={g}>{g}</option>
            )}
          </select>
          <input type="text" placeholder="文风/基调(如:热血、轻松、暗黑)" value={tone} onChange={e => setTone(e.target.value)} />
        </fieldset>

        <fieldset>
          <legend>世界观设定</legend>
          <textarea placeholder="详细描述你的世界观：地理环境、社会规则、力量体系、历史背景..." value={worldview} onChange={e => setWorldview(e.target.value)} required rows={6} />
        </fieldset>

        <fieldset>
          <legend>故事大纲 & 核心冲突</legend>
          <textarea placeholder="故事大纲：从开端到结局的主线描述" value={outline} onChange={e => setOutline(e.target.value)} required rows={6} />
          <textarea placeholder="核心冲突：推动整个故事的主要矛盾是什么？" value={conflict} onChange={e => setConflict(e.target.value)} required rows={4} />
        </fieldset>

        <fieldset>
          <legend>主角设定</legend>
          <input type="text" placeholder="角色名" value={charName} onChange={e => setCharName(e.target.value)} required />
          <select value={charRole} onChange={e => setCharRole(e.target.value)}>
            <option value="protagonist">主角</option>
            <option value="antagonist">反派</option>
            <option value="supporting">配角</option>
          </select>
          <input type="text" placeholder="外貌描述" value={charAppearance} onChange={e => setCharAppearance(e.target.value)} required />
          <input type="text" placeholder="性格特点" value={charPersonality} onChange={e => setCharPersonality(e.target.value)} required />
          <textarea placeholder="角色动机" value={charMotivation} onChange={e => setCharMotivation(e.target.value)} required rows={2} />
          <textarea placeholder="角色背景故事" value={charBackstory} onChange={e => setCharBackstory(e.target.value)} required rows={3} />
        </fieldset>

        <button type="submit">提交投稿</button>
      </form>
    </div>
  );
}

function BookDetailPage() {
  // 简化版: 直接用路由参数
  const bookId = window.location.pathname.split('/')[2];
  const [book, setBook] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);

  useEffect(() => {
    if (bookId) {
      api.getBook(bookId).then(setBook).catch(console.error);
      api.getChapters(bookId).then(data => setChapters(data.chapters || [])).catch(console.error);
    }
  }, [bookId]);

  if (!book) return <div className="page">加载中...</div>;

  return (
    <div className="page">
      <h1>{book.title}</h1>
      <span className="genre-tag">{book.genre}</span>
      <p>{book.synopsis}</p>

      <h2>目录 ({chapters.length} 章)</h2>
      <ul className="chapter-list">
        {chapters.map((ch: any) => (
          <li key={ch.chapter_number}>
            <Link to={`/books/${bookId}/chapters/${ch.chapter_number}`}>
              第{ch.chapter_number}章 {ch.title}
            </Link>
            <small>{ch.word_count}字</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- 导航栏 ----

function Navbar() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (api.getToken()) {
      api.getMe().then(setUser).catch(() => api.logout());
    }
  }, []);

  return (
    <nav className="navbar">
      <Link to="/" className="logo">AI小说</Link>
      <div className="nav-links">
        <Link to="/">首页</Link>
        {user ? (
          <>
            <Link to="/submit">投稿</Link>
            <span>{user.username} ({user.role})</span>
            <button onClick={() => { api.logout(); setUser(null); }}>退出</button>
          </>
        ) : (
          <>
            <Link to="/login">登录</Link>
            <Link to="/register">注册</Link>
          </>
        )}
      </div>
    </nav>
  );
}

// ---- 主应用 ----

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/submit" element={<SubmitPage />} />
          <Route path="/books/:id" element={<BookDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}
