// 专注测试投票→第2章
const BASE = 'https://ainovel-api.waitli.workers.dev';
const PROXY = 'http://172.20.224.1:8080';
const { ProxyAgent } = await import('undici');
const d = new ProxyAgent({ uri: PROXY });

async function api(m, p, b, t) {
  const h = { 'Content-Type': 'application/json' };
  if (t) h['Authorization'] = `Bearer ${t}`;
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(`${BASE}${p}`, { method: m, headers: h, body: b && JSON.stringify(b), dispatcher: d });
      return r.json();
    } catch (e) { if (a === 2) throw e; await new Promise(r => setTimeout(r, 3000)); }
  }
}

// 获取现有书目和方向
const login = await api('POST', '/api/v1/auth/login', { email: 'admin_1776214980322@test.com', password: 'admin123' });
const at = login.data?.token;

const books = await api('GET', '/api/v1/books?status=active', null, at);
const bid = books.data?.books?.[0]?.id;
if (!bid) { console.log('没有活跃书目'); process.exit(1); }
console.log(`书目: ${bid}`);

const chs = await api('GET', `/api/v1/books/${bid}/chapters`);
const chapters = chs.data?.chapters || [];
console.log(`章节数: ${chapters.length}`);

if (chapters.length === 0) { console.log('无章节'); process.exit(1); }

// 获取方向
const dirs = await api('GET', `/api/v1/books/${bid}/chapters/1/directions`);
const directions = dirs.data?.directions || [];
console.log(`方向数: ${directions.length}`);

if (directions.length === 0) { console.log('无方向'); process.exit(1); }

const dirId = directions[0].id;
console.log(`投票方向: ${dirId} (${directions[0].title})`);

// 注册3个用户投票
const ts = Date.now();
for (let i = 0; i < 3; i++) {
  const rr = await api('POST', '/api/v1/auth/register', {
    username: `v${ts}${i}`, email: `v${ts}${i}@t.com`, password: '123456'
  });
  const vt = rr.data?.token;
  console.log(`\n投票 ${i + 1}/3 (用户: ${rr.data?.user?.username})...`);
  const vote = await api('POST', '/api/v1/votes', { direction_id: dirId }, vt);
  console.log(`  结果: ${JSON.stringify(vote)}`);
}

// 等待第2章
console.log('\n等待第2章...');
for (let i = 0; i < 16; i++) {
  await new Promise(r => setTimeout(r, 7500));
  const ch2 = await api('GET', `/api/v1/books/${bid}/chapters`);
  const c2 = ch2.data?.chapters || [];
  console.log(`  ${(i + 1) * 7.5}s: ${c2.length} 章`);
  if (c2.length >= 2) {
    console.log(`\n✅ 第2章: "${c2[1].title}" (${c2[1].word_count}字)`);
    break;
  }
}
