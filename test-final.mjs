const BASE = 'https://ainovel-api.waitli.workers.dev';
const ORCH = 'https://ainovel-orchestrator.waitli.workers.dev';
const PROXY = 'http://172.20.224.1:8080';
const { ProxyAgent } = await import('undici');
const d = new ProxyAgent({ uri: PROXY });

async function api(m, p, b, t, base = BASE) {
  const h = { 'Content-Type': 'application/json' };
  if (t) h['Authorization'] = `Bearer ${t}`;
  const r = await fetch(`${base}${p}`, { method: m, headers: h, body: b && JSON.stringify(b), dispatcher: d });
  return r.json();
}

const ts = Date.now();

// 1. 登录管理员
console.log('1. 管理员登录...');
const login = await api('POST', '/api/v1/auth/login', { email: 'admin_1776214980322@test.com', password: 'admin123' });
const at = login.data?.token;  // 修复: 不是 data.data
console.log(`   ✅ ${login.data?.user?.role} token=${at?.slice(0,20)}...\n`);

// 2. 注册读者
console.log('2. 注册读者...');
const rr = await api('POST', '/api/v1/auth/register', { username: `r${ts}`, email: `r${ts}@t.com`, password: '123456' });
const rt = rr.data?.token;
console.log(`   ✅ ${rr.data?.user?.username}\n`);

// 3. 投稿
console.log('3. 投稿《万古武帝》...');
const sub = await api('POST', '/api/v1/submissions', {
  title: '万古武帝', genre: '玄幻',
  worldview: '苍穹大陆武者为尊，武道九境：淬体通脉凝元化神洞虚渡劫大乘飞升永恒。三大圣地五大宗门。',
  outline: '少年叶尘偶得太古经传承，从废物逆袭成就武帝。',
  core_conflict: '太古经引三大圣地觊觎。',
  tone: '热血',
  characters: [{ name: '叶尘', role: 'protagonist', appearance: '少年', personality: '坚毅', motivation: '武道', backstory: '废物逆袭' }],
}, rt);
const bid = sub.data?.id;
console.log(`   ✅ book_id: ${bid} status: ${sub.data?.status}\n`);

// 4. 直接触发 orchestrator
console.log('4. 触发 orchestrator /init-book ...');
const t0 = Date.now();
const initResp = await api('POST', '/init-book', {
  type: 'INIT_BOOK', book_id: bid,
  submission: {
    title: '万古武帝', genre: '玄幻',
    worldview: '苍穹大陆武者为尊，武道九境。',
    outline: '叶尘逆袭成就武帝。',
    core_conflict: '太古经引觊觎。',
    tone: '热血',
    characters: [{ name: '叶尘', role: 'protagonist', appearance: '少年', personality: '坚毅', motivation: '武道', backstory: '逆袭' }],
  }
}, null, ORCH);
console.log(`   耗时: ${((Date.now()-t0)/1000).toFixed(1)}s`);
console.log(`   响应: ${JSON.stringify(initResp).slice(0,200)}\n`);

if (initResp.success) {
  console.log('5. 检查章节...');
  const ch = await api('GET', `/api/v1/books/${bid}/chapters`);
  const chapters = ch.data?.chapters || [];
  if (chapters.length > 0) {
    console.log(`   ✅ ${chapters[0].title} (${chapters[0].word_count}字)`);
    const read = await api('GET', `/api/v1/books/${bid}/chapters/1`);
    const content = read.data?.content || '';
    console.log(`\n--- 正文 ---\n${content.slice(0,600)}\n---`);
    const dirs = await api('GET', `/api/v1/books/${bid}/chapters/1/directions`);
    console.log(`\n--- 方向 ---`);
    (dirs.data?.directions||[]).forEach(dd => console.log(`  ${dd.direction_number}. ${dd.title}`));
  }
} else {
  console.log('   ⚠️ ' + initResp.error);
}
console.log('\n=== 完成 ===');
