// 逐本初始化小说 — 使用 HTTP_PROXY 环境变量
process.env.HTTP_PROXY = 'http://172.20.224.1:8080';
process.env.HTTPS_PROXY = 'http://172.20.224.1:8080';

const API = 'https://api.ainovel.waitli.top/api/v1';

async function api(method, path, body, token) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!d.success) throw new Error(`${path}: ${d.error}`);
  return d.data;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Login
const reader = await api('POST', '/auth/login', { email: 'n1776325916530@ink.com', password: 'create2026' });
console.log(`登录: ${reader.user.username}`);

// Get approved books
const subs = await api('GET', '/submissions?status=approved&limit=50', undefined, reader.token);
const books = subs.books || [];
console.log(`待初始化: ${books.length} 本\n`);

for (let i = 0; i < books.length; i++) {
  const book = books[i];
  const sub = typeof book.submission_data === 'string' ? JSON.parse(book.submission_data) : book.submission_data;
  const lang = sub.language || 'zh';
  process.stdout.write(`[${i+1}/${books.length}] ${book.title} [${lang}] ... `);

  try {
    const r = await fetch('https://ainovel-orchestrator.waitli.workers.dev/init-book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'INIT_BOOK', book_id: book.id, submission: sub }),
    });
    const result = await r.json();
    if (result.success) {
      console.log('✓');
    } else if (result.error?.includes('429') || result.error?.includes('cooldown')) {
      console.log('⏳ 限速，等待 90s...');
      await sleep(90000);
      const r2 = await fetch('https://ainovel-orchestrator.waitli.workers.dev/init-book', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'INIT_BOOK', book_id: book.id, submission: sub }),
      });
      const r2d = await r2.json();
      console.log(`  ${r2d.success ? '✓ 重试成功' : '✗ ' + (r2d.error || '').slice(0, 60)}`);
    } else if (result.error?.includes('UNIQUE')) {
      console.log('⊘ 已有章节');
    } else {
      console.log(`✗ ${(result.error || '').slice(0, 60)}`);
    }
  } catch(e) {
    console.log(`✗ ${e.message?.slice(0, 60)}`);
  }

  if (i < books.length - 1) {
    process.stdout.write('  等待 45s...\n');
    await sleep(45000);
  }
}

console.log('\n检查结果...');
await sleep(10000);
const active = await api('GET', '/books?status=active&limit=50', undefined, reader.token);
console.log(`\n活跃书籍 (${active.books?.length || 0}):`);
for (const b of active.books || []) console.log(`  ${b.title} [${b.language}] — ${b.current_chapter}章`);
console.log('\n✅ 完成');
