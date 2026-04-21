import { ProxyAgent } from 'undici';
const agent = new ProxyAgent('http://172.20.224.1:8080');
const API = 'https://api.ainovel.waitli.top/api/v1';

async function initBook(bookId) {
  // Get book data
  const res = await fetch(`${API}/books/${bookId}`, { dispatcher: agent });
  const d = await res.json();
  if (!d.success) return console.log(`  skip ${bookId}: not found`);
  const book = d.data;
  if (book.current_chapter >= 1) return console.log(`  skip ${book.title}: already has chapters`);
  
  const sub = typeof book.submission_data === 'string' ? JSON.parse(book.submission_data) : book.submission_data;
  console.log(`  初始化: ${book.title} [${sub.language || 'zh'}] ...`);
  
  try {
    const r = await fetch('https://ainovel-orchestrator.waitli.workers.dev/init-book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'INIT_BOOK', book_id: bookId, submission: sub }),
      dispatcher: agent,
    });
    const result = await r.json();
    if (result.success) console.log(`    ✓ 完成`);
    else if (result.error?.includes('429') || result.error?.includes('cooldown')) {
      console.log(`    ⏳ 限速，等待 60 秒后重试...`);
      await new Promise(r => setTimeout(r, 60000));
      const r2 = await fetch('https://ainovel-orchestrator.waitli.workers.dev/init-book', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'INIT_BOOK', book_id: bookId, submission: sub }), dispatcher: agent,
      });
      const r2d = await r2.json();
      console.log(`    ${r2d.success ? '✓ 重试成功' : '✗ ' + r2d.error?.slice(0, 60)}`);
    } else {
      console.log(`    ✗ ${result.error?.slice(0, 80)}`);
    }
  } catch (e) {
    console.log(`    ✗ ${e.message}`);
  }
}

// Get all approved books with 0 chapters
const res = await fetch(`${API}/books?status=approved&limit=50`, { dispatcher: agent });
const d = await res.json();
// books in 'approved' status with 0 chapters - need to check status differently
// Let me just get all books and filter
const allRes = await fetch(`${API}/books?status=active&limit=50`, { dispatcher: agent });
const allD = await allRes.json();
const activeIds = new Set((allD.data?.books || []).map(b => b.id));

// Get approved books from D1 directly - use the API
// Actually, let me just iterate known book IDs from the submission script
const bookIds = [
  // New 10 books (from seed-submit.mjs)
  '9d68fd35-2e0c-4a16-8ea3-1a635d122de3', // 锈铁王座
  'b3c81e7a-a7e7-44c4-9c44-5a39ca2949b8', // 倒数第七天  
  'c1d6f27e-2e5b-4e2c-a5f8-1f57b3ee28a1', // 星际拾荒者
  'd2e7f38f-3f6c-4f3d-b6g9-2g68c4ff39b2', // 半山茶馆
  'e3f8g49g-4g7d-4g4e-c7h0-3h79d5gg40c3', // 画皮师
  'f4g9h50h-5h8e-4h5f-d8i1-4i80e6hh51d4', // The Cartographer
  'g5h0i61i-6i9f-4i6g-e9j2-5j91f7ii62e5', // Signal Decay
  'h6i1j72j-7j0g-4j7h-f0k3-6k02g8jj73f6', // Glasswright
  'i7j2k83k-8k1h-4k8i-g1l4-7l13h9kk84g7', // Borrowed Skin
  'j8k3l94l-9l2i-4l9j-h2m5-8m24i0ll95h8', // Apiarist
];

// Actually I don't know the exact IDs. Let me just get them from D1:
console.log('获取待初始化的书籍...');
const dbRes = await fetch('https://api.ainovel.waitli.top/api/v1/books?status=approved&limit=50', { dispatcher: agent });
// The API filters by status=active by default, so approved books won't show
// Let me call orchestrator for all books that might be stuck

// Better approach: get IDs from D1 directly
// For now, let me just try the orchestrator for the known book titles
const titles = [
  { id: null, title: '锈铁王座', lang: 'zh' },
  { id: null, title: '倒数第七天', lang: 'zh' },
  { id: null, title: '星际拾荒者', lang: 'zh' },
  { id: null, title: '半山茶馆', lang: 'zh' },
  { id: null, title: '画皮师', lang: 'zh' },
  { id: null, title: 'The Cartographer of Dead Cities', lang: 'en' },
  { id: null, title: 'Signal Decay', lang: 'en' },
  { id: null, title: "The Glasswright's Daughter", lang: 'en' },
  { id: null, title: 'Beneath the Borrowed Skin', lang: 'en' },
  { id: null, title: "The Apiarist's War", lang: 'en' },
];

// Get IDs from submission list
const reader = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'n1776325916530@ink.com', password: 'create2026' }),
  dispatcher: agent,
});
const readerD = await reader.json();
const token = readerD.data.token;

const subs = await fetch(`${API}/submissions?status=approved&limit=50`, {
  headers: { 'Authorization': `Bearer ${token}` },
  dispatcher: agent,
});
const subsD = await subs.json();
console.log(`找到 ${subsD.data?.books?.length || 0} 本待审批书籍`);

for (const book of (subsD.data?.books || [])) {
  const sub = typeof book.submission_data === 'string' ? JSON.parse(book.submission_data) : book.submission_data;
  await initBook(book.id);
  // Wait 30s between books to avoid AI rate limiting
  await new Promise(r => setTimeout(r, 30000));
}

console.log('\n等待 30 秒后检查结果...');
await new Promise(r => setTimeout(r, 30000));

const activeBooks = await fetch(`${API}/books?status=active&limit=50`, { dispatcher: agent });
const activeD = await activeBooks.json();
console.log(`\n活跃书籍: ${activeD.data?.books?.length || 0} 本`);
for (const b of activeD.data?.books || []) {
  console.log(`  ${b.title} [${b.language}] — ${b.current_chapter}章`);
}
