// 审批 → AI生成 简化测试
const BASE = 'https://ainovel-api.waitli.workers.dev';
const PROXY = 'http://172.20.224.1:8080';
const { ProxyAgent } = await import('undici');
const dispatcher = new ProxyAgent({ uri: PROXY });

async function api(method, path, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, {
    method, headers: h,
    body: body && JSON.stringify(body),
    dispatcher,
  });
  return r.json();
}

// 管理员登录
console.log('1. 管理员登录...');
const login = await api('POST', '/api/v1/auth/login', {
  email: 'admin_1776214980322@test.com', password: 'admin123'
});
const token = login.data?.token;
console.log(`   角色: ${login.data?.user?.role}`);

// 获取待审批
console.log('2. 获取待审批...');
const subs = await api('GET', '/api/v1/submissions?status=pending', null, token);
const books = subs.data?.books || [];
console.log(`   待审批: ${books.length} 本`);

if (books.length === 0) { console.log('没有待审批'); process.exit(0); }

const bookId = books[0].id;
const bookTitle = books[0].title;
console.log(`   审批: ${bookTitle} (${bookId})`);

// 审批
console.log('3. 审批通过...');
const approve = await api('POST', `/api/v1/submissions/${bookId}/approve`, null, token);
console.log(`   结果: ${JSON.stringify(approve).slice(0, 200)}`);

// 轮询
console.log('4. 等待AI生成 (3分钟)...');
for (let i = 0; i < 24; i++) {
  await new Promise(r => setTimeout(r, 7500));
  const ch = await api('GET', `/api/v1/books/${bookId}/chapters`);
  const chapters = ch.data?.chapters || [];
  if (chapters.length > 0) {
    console.log(`\n✅ 第一章生成成功!`);
    console.log(`   标题: ${chapters[0].title}`);
    console.log(`   字数: ${chapters[0].word_count}`);

    const read = await api('GET', `/api/v1/books/${bookId}/chapters/1`);
    console.log(`\n--- 正文预览 ---\n${(read.data?.content || '').slice(0, 600)}\n---`);

    const dirs = await api('GET', `/api/v1/books/${bookId}/chapters/1/directions`);
    console.log(`\n--- 方向选项 ---`);
    (dirs.data?.directions || []).forEach(d =>
      console.log(`  方向${d.direction_number}: ${d.title} — ${d.description?.slice(0, 60)}`)
    );

    // 投票
    const directions = dirs.data?.directions || [];
    if (directions.length > 0) {
      console.log(`\n5. 读者投票给方向1...`);
      // 注册新读者
      const rr = await api('POST', '/api/v1/auth/register', {
        username: `voter_${Date.now()}`, email: `voter_${Date.now()}@t.com`, password: '123456'
      });
      const voterToken = rr.data?.token;
      const vote = await api('POST', '/api/v1/votes', { direction_id: directions[0].id }, voterToken);
      console.log(`   投票: ${JSON.stringify(vote).slice(0, 150)}`);
    }
    process.exit(0);
  }
  process.stdout.write('.');
}
console.log('\n⚠️ 超时，请检查 orchestrator 日志');
