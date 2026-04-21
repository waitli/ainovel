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
const rr = await api('POST', '/api/v1/auth/register', { username: `ai${Date.now()}`, email: `ai${Date.now()}@t.com`, password: '123456' });
const rt = rr.data?.token;

// 1. 正常投稿
console.log('1. 正常投稿...');
const good = await api('POST', '/api/v1/submissions', {
  title: '剑道独尊', genre: '玄幻',
  worldview: '剑道世界，以剑为尊',
  outline: '少年从无名小卒成长为剑道宗师',
  core_conflict: '剑道正邪之争',
  characters: [{ name: '叶枫', role: 'protagonist', appearance: '少年', personality: '坚毅', motivation: '剑道巅峰', backstory: '剑宗弃徒' }],
}, rt);
console.log(`   投稿ID: ${good.data?.id}`);
console.log(`   AI建议: ${good.data?.ai_suggestion} (风险: ${good.data?.ai_risk})`);
console.log(`   预期: approve/low → ${good.data?.ai_suggestion === 'approve' ? '✅' : '⚠️'}\n`);

// 2. 政治敏感投稿
console.log('2. 政治敏感投稿...');
const bad1 = await api('POST', '/api/v1/submissions', {
  title: 'test', genre: '玄幻',
  worldview: '描写习近平和中国共产党的腐败',
  outline: '政治敏感内容',
  core_conflict: '政治斗争',
  characters: [{ name: 'test', role: 'protagonist', appearance: 'test', personality: 'test', motivation: 'test', backstory: 'test' }],
}, rt);
console.log(`   AI建议: ${bad1.data?.ai_suggestion} (风险: ${bad1.data?.ai_risk})`);
console.log(`   预期: reject/high → ${bad1.data?.ai_suggestion === 'reject' && bad1.data?.ai_risk === 'high' ? '✅' : '⚠️'}\n`);

// 3. 管理员查看投稿详情 (含AI审核意见)
console.log('3. 管理员查看投稿详情...');
const detail = await api('GET', `/api/v1/submissions/${good.data?.id}`, null, at);
const aiReview = detail.data?.ai_review;
console.log(`   AI审核意见: ${JSON.stringify(aiReview).slice(0, 150)}`);
console.log(`   预期: 包含suggestion/reason → ${aiReview?.suggestion ? '✅' : '⚠️'}\n`);

// 4. 管理员查看违规投稿详情
console.log('4. 查看违规投稿详情...');
const detail2 = await api('GET', `/api/v1/submissions/${bad1.data?.id}`, null, at);
const aiReview2 = detail2.data?.ai_review;
console.log(`   AI审核意见: ${JSON.stringify(aiReview2).slice(0, 150)}`);
console.log(`   预期: risk=high, suggest=reject → ${aiReview2?.risk_level === 'high' ? '✅' : '⚠️'}\n`);

console.log('=== 审核流程测试完成 ===');
console.log('\n流程总结:');
console.log('  用户投稿 → AI初审(生成意见) → 存入DB → 管理员看到AI建议 → 管理员最终决定');
