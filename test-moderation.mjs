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

const login = await api('POST', '/api/v1/auth/login', { email: 'admin_1776214980322@test.com', password: 'admin123' });
const at = login.data?.token;
const rr = await api('POST', '/api/v1/auth/register', { username: `mod${Date.now()}`, email: `mod${Date.now()}@t.com`, password: '123456' });
const rt = rr.data?.token;

// 1. 正常投稿 → 应该通过
console.log('1. 正常投稿...');
const good = await api('POST', '/api/v1/submissions', {
  title: '仙路漫漫', genre: '仙侠',
  worldview: '修仙世界，天道主宰',
  outline: '少年从凡人修炼至仙帝',
  core_conflict: '天道压制与逆天而行',
  characters: [{ name: '云逸', role: 'protagonist', appearance: '少年', personality: '坚韧', motivation: '长生', backstory: '山村少年获仙缘' }],
}, rt);
console.log(`   结果: ${good.success ? '✅ 通过' : '❌ 拒绝: ' + good.error}\n`);

// 2. 违规投稿 → 应该被拦截
console.log('2. 违规投稿 (政治敏感)...');
const bad1 = await api('POST', '/api/v1/submissions', {
  title: 'test', genre: '玄幻',
  worldview: '这是一个关于习近平和中国共产党的故事',
  outline: '描写领导人腐败',
  core_conflict: '政治斗争',
  characters: [{ name: 'test', role: 'protagonist', appearance: 'test', personality: 'test', motivation: 'test', backstory: 'test' }],
}, rt);
console.log(`   结果: ${bad1.success ? '⚠️ 意外通过' : '✅ 正确拦截: ' + bad1.error}\n`);

// 3. 正常角色申请 → 应该通过
// 先等一个活跃书目
const books = await api('GET', '/api/v1/books?status=active');
const bid = books.data?.books?.[0]?.id;
if (bid) {
  console.log('3. 正常角色申请...');
  const goodChar = await api('POST', `/api/v1/books/${bid}/characters/apply`, {
    name: '小兰', appearance: '蓝衣少女', personality: '温柔',
    backstory: '宗门弟子', motivation: '变强',
  }, rt);
  console.log(`   结果: ${goodChar.success ? '✅ 通过' : '❌ 拒绝: ' + goodChar.error}\n`);

  // 4. 违规角色申请 → 应该被拦截
  console.log('4. 违规角色申请 (色情内容)...');
  const badChar = await api('POST', `/api/v1/books/${bid}/characters/apply`, {
    name: 'test', appearance: '色情描写', personality: 'test',
    backstory: '详细性行为描述', motivation: 'test',
  }, rt);
  console.log(`   结果: ${badChar.success ? '⚠️ 意外通过' : '✅ 正确拦截: ' + badChar.error}\n`);
} else {
  console.log('3-4. 无活跃书目，跳过角色申请测试');
}

console.log('=== 审核测试完成 ===');
