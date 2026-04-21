// 检查 orchestrator 和 queue 状态
const PROXY = 'http://172.20.224.1:8080';
const { ProxyAgent } = await import('undici');
const dispatcher = new ProxyAgent({ uri: PROXY });

// 1. 检查 orchestrator 健康
console.log('1. Orchestrator health...');
const r1 = await fetch('https://ainovel-orchestrator.waitli.workers.dev/health', { dispatcher });
console.log(`   状态: ${r1.status} ${await r1.text()}\n`);

// 2. 检查 queue 是否有积压消息
console.log('2. 检查队列...');
// 可以通过 API 获取 queue 状态，但需要 admin token
const BASE = 'https://ainovel-api.waitli.workers.dev';

// 登录
const loginResp = await fetch(`${BASE}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin_1776214980322@test.com', password: 'admin123' }),
  dispatcher,
});
const loginData = await loginResp.json();
const at = loginData.data?.data?.token;
console.log(`   Admin token: ${at?.slice(0, 20)}...`);

// 3. 查看书目状态
const booksResp = await fetch(`${BASE}/api/v1/books?status=approved`, {
  headers: { 'Authorization': `Bearer ${at}` },
  dispatcher,
});
const booksData = await booksResp.json();
console.log(`   已审批书目: ${JSON.stringify(booksData.data?.data)}\n`);

// 4. 尝试手动触发 orchestrator (跳过 queue)
console.log('4. 直接调用 orchestrator /health...');
const r2 = await fetch('https://ainovel-orchestrator.waitli.workers.dev/health', { dispatcher });
console.log(`   ${await r2.text()}`);

console.log('\nDone');
