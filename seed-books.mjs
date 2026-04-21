const BASE = 'https://ainovel-api.waitli.workers.dev';
const PROXY = 'http://172.20.224.1:8080';
const { ProxyAgent } = await import('undici');
const d = new ProxyAgent({ uri: PROXY });

async function api(m, p, b, t) {
  const h = { 'Content-Type': 'application/json' };
  if (t) h['Authorization'] = `Bearer ${t}`;
  for (let a = 0; a < 3; a++) {
    try { const r = await fetch(`${BASE}${p}`, { method: m, headers: h, body: b && JSON.stringify(b), dispatcher: d }); return r.json(); }
    catch (e) { if (a === 2) throw e; await new Promise(r => setTimeout(r, 3000)); }
  }
}

const login = await api('POST', '/api/v1/auth/login', { email: 'admin_1776214980322@test.com', password: 'admin123' });
const at = login.data?.token;
const rr = await api('POST', '/api/v1/auth/register', { username: `seed${Date.now()}`, email: `seed${Date.now()}@t.com`, password: '123456' });
const rt = rr.data?.token;

const books = [
  { title: '万古武帝', genre: '玄幻', worldview: '苍穹大陆武者为尊，武道九境：淬体通脉凝元化神洞虚渡劫大乘飞升永恒', outline: '少年叶尘偶得太古经传承，从废物逆袭成就武帝', core_conflict: '太古经引三大圣地觊觎' },
  { title: '星辰变', genre: '仙侠', worldview: '九重天之上仙帝陨落，星辰之力散落人间', outline: '秦羽从凡人踏上修仙之路', core_conflict: '仙界权谋与凡间命运交织' },
  { title: '斗破苍穹', genre: '玄幻', worldview: '斗气大陆，以斗气为修炼体系', outline: '萧炎从天才沦为废物再逆袭', core_conflict: '三十年河东三十年河西' },
  { title: '遮天', genre: '仙侠', worldview: '太古时代，万族林立，天骄并起', outline: '叶凡被九龙拉棺带到修仙界', core_conflict: '红尘仙路，大道争锋' },
  { title: '诡秘之主', genre: '奇幻', worldview: '蒸汽与机械的时代，非凡力量暗中涌动', outline: '周明瑞穿越成为克莱恩探索神秘世界', core_conflict: '途径之争与神灵博弈' },
];

for (const b of books) {
  const sub = await api('POST', '/api/v1/submissions', { ...b, tone: '热血', characters: [{ name: '主角', role: 'protagonist', appearance: '少年', personality: '坚韧', motivation: '变强', backstory: '逆袭' }] }, rt);
  console.log(`投稿: ${b.title} → ${sub.data?.id ? '✅' : '❌'}`);
  if (sub.data?.id) {
    await api('POST', `/api/v1/submissions/${sub.data.id}/approve`, null, at);
    console.log(`  审批通过，等待AI生成...`);
  }
}

console.log('\n等待10秒后检查...');
await new Promise(r => setTimeout(r, 10000));
const active = await api('GET', '/api/v1/books?status=active', null, at);
console.log(`活跃书目: ${(active.data?.books || []).length} 本`);

const pending = await api('GET', '/api/v1/books?status=approved', null, at);
console.log(`生成中: ${(pending.data?.books || []).length} 本`);
console.log('\n刷新页面查看: https://ainovel-frontend.pages.dev');
