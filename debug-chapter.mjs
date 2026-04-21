const BASE = 'https://ainovel-api.waitli.workers.dev';
const ORCH = 'https://ainovel-orchestrator.waitli.workers.dev';
const PROXY = 'http://172.20.224.1:8080';
const { ProxyAgent } = await import('undici');
const d = new ProxyAgent({ uri: PROXY });

const login = await fetch(`${BASE}/api/v1/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin_1776214980322@test.com', password: 'admin123' }),
  dispatcher: d
});
const at = (await login.json()).data?.token;

// 获取最新书目
const booksR = await fetch(`${BASE}/api/v1/books?status=active`, { headers: { 'Authorization': `Bearer ${at}` }, dispatcher: d });
const booksD = await booksR.json();
console.log('Books:', JSON.stringify(booksD, null, 2).slice(0, 300));

const bid = booksD.data?.books?.[0]?.id;
if (!bid) { console.log('No active books'); process.exit(1); }

console.log(`\nBook ID: ${bid}`);

// 获取章节列表
const chR = await fetch(`${BASE}/api/v1/books/${bid}/chapters`, { dispatcher: d });
const chD = await chR.json();
console.log('\nChapters:', JSON.stringify(chD, null, 2).slice(0, 500));

// 读取第一章
const readR = await fetch(`${BASE}/api/v1/books/${bid}/chapters/1`, { dispatcher: d });
const readD = await readR.json();
console.log('\nChapter 1 full response:', JSON.stringify(readD, null, 2).slice(0, 1000));

// 方向
const dirR = await fetch(`${BASE}/api/v1/books/${bid}/chapters/1/directions`, { dispatcher: d });
const dirD = await dirR.json();
console.log('\nDirections:', JSON.stringify(dirD, null, 2));
