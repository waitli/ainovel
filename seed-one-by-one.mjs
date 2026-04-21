import { ProxyAgent } from 'undici';
const agent = new ProxyAgent('http://172.20.224.1:8080');
const API = 'https://api.ainovel.waitli.top/api/v1';

// Login
const loginRes = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'n1776325916530@ink.com', password: 'create2026' }),
  dispatcher: agent,
});
const loginD = await loginRes.json();
const token = loginD.data.token;
console.log(`Logged in: ${loginD.data.user.username}`);

// Get pending submissions
const subsRes = await fetch(`${API}/submissions?status=approved&limit=50`, {
  headers: { 'Authorization': `Bearer ${token}` },
  dispatcher: agent,
});
const subsD = await subsRes.json();
const books = subsD.data?.books || [];
console.log(`Found ${books.length} approved books`);

// Init one at a time
for (let i = 0; i < books.length; i++) {
  const book = books[i];
  const sub = typeof book.submission_data === 'string' ? JSON.parse(book.submission_data) : book.submission_data;
  const lang = sub.language || 'zh';
  console.log(`\n[${i+1}/${books.length}] ${book.title} [${lang}]`);
  
  try {
    const r = await fetch('https://ainovel-orchestrator.waitli.workers.dev/init-book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'INIT_BOOK', book_id: book.id, submission: sub }),
      dispatcher: agent,
    });
    const result = await r.json();
    if (result.success) {
      console.log('  ✓ 成功');
    } else {
      const err = result.error || '';
      if (err.includes('429') || err.includes('cooldown')) {
        console.log('  ⏳ AI限速，等待 90 秒...');
        await new Promise(r => setTimeout(r, 90000));
        // Retry
        const r2 = await fetch('https://ainovel-orchestrator.waitli.workers.dev/init-book', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'INIT_BOOK', book_id: book.id, submission: sub }),
          dispatcher: agent,
        });
        const r2d = await r2.json();
        console.log(`  ${r2d.success ? '✓ 重试成功' : '✗ ' + (r2d.error || '').slice(0, 80)}`);
      } else if (err.includes('UNIQUE constraint')) {
        console.log('  ⊘ 已有章节，跳过');
      } else {
        console.log(`  ✗ ${err.slice(0, 80)}`);
      }
    }
  } catch(e) {
    console.log(`  ✗ ${e.message}`);
  }
  
  // Wait between books
  if (i < books.length - 1) {
    console.log('  等待 45 秒...');
    await new Promise(r => setTimeout(r, 45000));
  }
}

console.log('\n=== 完成 ===');
