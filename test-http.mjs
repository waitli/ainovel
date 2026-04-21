// HTTP 直连测试 — 绕过 Queue
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

console.log('=== Phase 1: 用户 & 投稿 ===\n');

// 管理员登录
console.log('1. 管理员登录...');
const login = await api('POST', '/api/v1/auth/login', { email: 'admin_1776214980322@test.com', password: 'admin123' });
const at = login.data?.data?.token;
console.log(`   ✅ ${login.data?.data?.user?.role}`);

// 读者注册
console.log('2. 注册读者...');
const rr = await api('POST', '/api/v1/auth/register', { username: `r${ts}`, email: `r${ts}@t.com`, password: '123456' });
const rt = rr.data?.data?.token;
console.log(`   ✅ ${rr.data?.data?.user?.username}`);

// 投稿
console.log('3. 投稿...');
const sub = await api('POST', '/api/v1/submissions', {
  title: '万古武帝', genre: '玄幻',
  worldview: '苍穹大陆武者为尊，武道九境：淬体通脉凝元化神洞虚渡劫大乘飞升永恒。三大圣地五大宗门掌控大陆，北方蛮荒妖兽横行，西方深渊封印上古魔族。',
  outline: '少年叶尘偶得太古经传承，从废物逆袭为绝世天才，碾压天骄，最终成就万古武帝。闯秘境、战天骄、破阴谋。',
  core_conflict: '叶尘体内太古经引三大圣地觊觎，正邪都想利用他，必须在夹缝中变强。',
  tone: '热血爽文',
  characters: [{ name: '叶尘', role: 'protagonist', appearance: '十七岁少年修长身材眉宇坚毅', personality: '冷静睿智杀伐果断', motivation: '武道极致', backstory: '叶家废物获太古经传承' }],
}, rt);
const bid = sub.data?.data?.id;
console.log(`   ✅ ${bid} (${sub.data?.data?.status})`);

console.log('\n=== Phase 2: 直接调用 Orchestrator 生成 ===\n');

// 直接 POST 到 orchestrator /init-book
console.log('4. 直接触发 orchestrator init-book...');
const initResp = await api('POST', '/init-book', {
  type: 'INIT_BOOK',
  book_id: bid,
  submission: {
    title: '万古武帝', genre: '玄幻',
    worldview: '苍穹大陆武者为尊，武道九境：淬体通脉凝元化神洞虚渡劫大乘飞升永恒。三大圣地五大宗门掌控大陆。',
    outline: '少年叶尘偶得太古经传承，从废物逆袭为绝世天才。',
    core_conflict: '叶尘体内太古经引三大圣地觊觎。',
    tone: '热血爽文',
    characters: [{ name: '叶尘', role: 'protagonist', appearance: '十七岁少年', personality: '冷静睿智', motivation: '武道极致', backstory: '叶家废物获太古经' }],
  }
}, null, ORCH);
console.log(`   响应: ${JSON.stringify(initResp).slice(0, 200)}\n`);

console.log('5. 检查生成结果...');
const ch = await api('GET', `/api/v1/books/${bid}/chapters`);
const chapters = ch.data?.data?.chapters || [];
if (chapters.length > 0) {
  console.log(`   ✅ 第一章: ${chapters[0].title} (${chapters[0].word_count}字)`);
  const read = await api('GET', `/api/v1/books/${bid}/chapters/1`);
  console.log(`\n--- 正文预览 ---\n${(read.data?.data?.content||'').slice(0,600)}\n---`);
  const dirs = await api('GET', `/api/v1/books/${bid}/chapters/1/directions`);
  console.log(`\n--- 方向 ---`);
  (dirs.data?.data?.directions||[]).forEach(dd => console.log(`  ${dd.direction_number}. ${dd.title}`));
} else {
  console.log('   ⚠️ 无章节，检查 orchestrator 错误');
}

console.log('\n=== 完成 ===');
