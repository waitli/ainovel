const BASE = 'https://ainovel-api.waitli.workers.dev';
const PROXY = 'http://172.20.224.1:8080';
const { ProxyAgent } = await import('undici');
const d = new ProxyAgent({ uri: PROXY });

async function api(m, p, b, t) {
  const h = { 'Content-Type': 'application/json' };
  if (t) h['Authorization'] = `Bearer ${t}`;
  const r = await fetch(`${BASE}${p}`, { method: m, headers: h, body: b && JSON.stringify(b), dispatcher: d });
  return r.json();
}

// 登录
const login = await api('POST', '/api/v1/auth/login', { email: 'admin_1776214980322@test.com', password: 'admin123' });
const at = login.data?.token;
const rr = await api('POST', '/api/v1/auth/register', { username: `fix${Date.now()}`, email: `fix${Date.now()}@t.com`, password: '123456' });
const rt = rr.data?.token;

// 1. 投稿 → 拒绝
console.log('1. 拒绝投稿测试...');
const sub = await api('POST', '/api/v1/submissions', {
  title: '拒绝测试', genre: '玄幻', worldview: '测试', outline: '测试', core_conflict: '测试',
  characters: [{ name: '测试', role: 'protagonist', appearance: '测试', personality: '测试', motivation: '测试', backstory: '测试' }],
}, rt);
console.log(`   投稿: ${JSON.stringify(sub).slice(0, 100)}`);
const bid = sub.data?.id;
const rej = await api('POST', `/api/v1/submissions/${bid}/reject`, { reason: '测试拒绝' }, at);
console.log(`   拒绝: ${JSON.stringify(rej).slice(0, 150)}\n`);

// 2. 投稿 → 审批 → 角色申请
console.log('2. 角色申请测试...');
const sub2 = await api('POST', '/api/v1/submissions', {
  title: '角色测试', genre: '玄幻', worldview: '测试', outline: '测试', core_conflict: '测试',
  characters: [{ name: '主角', role: 'protagonist', appearance: '少年', personality: '坚毅', motivation: '变强', backstory: '废物' }],
}, rt);
const bid2 = sub2.data?.id;
await api('POST', `/api/v1/submissions/${bid2}/approve`, null, at);
console.log(`   书目: ${bid2}`);

// 等第1章
console.log('   等待章节...');
for (let i = 0; i < 16; i++) {
  await new Promise(r => setTimeout(r, 7500));
  const ch = await api('GET', `/api/v1/books/${bid2}/chapters`);
  if ((ch.data?.chapters || []).length > 0) { console.log('   ✅ 章节已生成'); break; }
  process.stdout.write('.');
}

// 角色申请
console.log('\n   角色申请...');
const charApp = await api('POST', `/api/v1/books/${bid2}/characters/apply`, {
  name: '小红', appearance: '红衣少女', personality: '活泼', backstory: '宗门弟子', motivation: '变强', abilities: '火系',
}, rt);
console.log(`   申请: ${JSON.stringify(charApp).slice(0, 200)}`);

// 申请列表
console.log('\n   申请列表...');
const apps = await api('GET', `/api/v1/books/${bid2}/characters/applications`, null, at);
console.log(`   列表: ${JSON.stringify(apps).slice(0, 200)}`);

// 书中角色
console.log('\n   书中角色...');
const chars = await api('GET', `/api/v1/books/${bid2}/characters`, null, rt);
console.log(`   角色: ${JSON.stringify(chars).slice(0, 200)}`);
