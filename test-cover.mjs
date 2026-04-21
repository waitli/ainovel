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

const login = await api('POST', '/api/v1/auth/login', { email: 'admin_1776214980322@test.com', password: 'admin123' });
const at = login.data?.token;
const rr = await api('POST', '/api/v1/auth/register', { username: `c${Date.now()}`, email: `c${Date.now()}@t.com`, password: '123456' });
const rt = rr.data?.token;

// 投稿
console.log('1. 投稿...');
const sub = await api('POST', '/api/v1/submissions', {
  title: '星辰变', genre: '仙侠',
  worldview: '九重天之上，仙帝陨落，星辰之力散落人间',
  outline: '少年秦羽偶得星辰碎片，从凡人踏上修仙之路',
  core_conflict: '仙界权谋与凡间命运交织',
  tone: '大气磅礴',
  characters: [{ name: '秦羽', role: 'protagonist', appearance: '少年', personality: '坚韧', motivation: '成仙', backstory: '山村少年' }],
}, rt);
const bid = sub.data?.id;
console.log(`   书目: ${bid}`);

// 审批
console.log('2. 审批...');
await api('POST', `/api/v1/submissions/${bid}/approve`, null, at);

// 等章节+封面
console.log('3. 等待AI生成章节+封面...');
for (let i = 0; i < 20; i++) {
  await new Promise(r => setTimeout(r, 7500));
  const ch = await api('GET', `/api/v1/books/${bid}/chapters`);
  if ((ch.data?.chapters || []).length > 0) {
    console.log(`   ✅ 章节已生成`);

    // 检查封面
    const coverResp = await fetch(`https://ainovel-reading.waitli.workers.dev/api/v1/books/${bid}/cover`, { dispatcher: d });
    if (coverResp.ok) {
      const size = (await coverResp.arrayBuffer()).byteLength;
      console.log(`   ✅ 封面已生成: ${(size / 1024).toFixed(1)}KB`);
    } else {
      console.log(`   ⚠️ 封面未生成 (status: ${coverResp.status})`);
    }
    break;
  }
  process.stdout.write('.');
}

console.log(`\n4. 打开查看: https://ainovel-frontend.pages.dev`);
