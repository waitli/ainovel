// 快速测试 Vectorize 集成
const BASE = 'https://ainovel-api.waitli.workers.dev';
const ORCH = 'https://ainovel-orchestrator.waitli.workers.dev';
const PROXY = 'http://172.20.224.1:8080';
const { ProxyAgent } = await import('undici');
const d = new ProxyAgent({ uri: PROXY };

async function api(m, p, b, t, base = BASE) {
  const h = { 'Content-Type': 'application/json' };
  if (t) h['Authorization'] = `Bearer ${t}`;
  const r = await fetch(`${base}${p}`, { method: m, headers: h, body: b && JSON.stringify(b), dispatcher: d });
  return r.json();
}

// 登录
const login = await api('POST', '/api/v1/auth/login', { email: 'admin_1776214980322@test.com', password: 'admin123' });
const at = login.data?.token;

// 注册读者
const rr = await api('POST', '/api/v1/auth/register', { username: `v${Date.now()}`, email: `v${Date.now()}@t.com`, password: '123456' });
const rt = rr.data?.token;

// 投稿
const sub = await api('POST', '/api/v1/submissions', {
  title: '向量测试', genre: '科幻',
  worldview: '未来世界AI统治一切',
  outline: '少年反抗AI统治',
  core_conflict: '人机对抗',
  characters: [{ name: '李明', role: 'protagonist', appearance: '少年', personality: '勇敢', motivation: '自由', backstory: 'AI实验室逃出' }],
}, rt);
const bid = sub.data?.id;
console.log(`Book: ${bid}`);

// 直接触发 orchestrator
console.log('触发 orchestrator...');
const t0 = Date.now();
const resp = await api('POST', '/init-book', {
  type: 'INIT_BOOK', book_id: bid,
  submission: { title: '向量测试', genre: '科幻', worldview: '未来世界AI统治', outline: '反抗', core_conflict: '人机对抗', characters: [{ name: '李明', role: 'protagonist', appearance: '少年', personality: '勇敢', motivation: '自由', backstory: '逃出' }] }
}, null, ORCH);
console.log(`耗时: ${((Date.now()-t0)/1000).toFixed(1)}s`);
console.log(`结果: ${JSON.stringify(resp).slice(0, 200)}`);

// 检查向量
console.log('\n检查向量索引...');
await new Promise(r => setTimeout(r, 5000));
