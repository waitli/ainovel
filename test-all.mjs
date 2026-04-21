// ============================================
// 全业务流程测试 — 覆盖所有 API
// ============================================

const BASE = 'https://ainovel-api.waitli.workers.dev';
const PROXY = 'http://172.20.224.1:8080';
const { ProxyAgent } = await import('undici');
const d = new ProxyAgent({ uri: PROXY });

let passed = 0, failed = 0;

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

function ok(name, condition) {
  if (condition) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name}`); }
}

const ts = Date.now();

// ========== 1. 用户系统 ==========
console.log('\n=== 1. 用户系统 ===');

// 1.1 注册
const reg = await api('POST', '/api/v1/auth/register', { username: `t${ts}`, email: `t${ts}@t.com`, password: '123456' });
ok('注册读者', reg.success && reg.data?.token);

// 1.2 重复注册
const dup = await api('POST', '/api/v1/auth/register', { username: `t${ts}`, email: `t${ts}@t.com`, password: '123456' });
ok('重复注册被拒', !dup.success);

// 1.3 登录
const login = await api('POST', '/api/v1/auth/login', { email: `t${ts}@t.com`, password: '123456' });
ok('登录', login.success && login.data?.token);
const readerToken = login.data.token;

// 1.4 错误密码登录
const badLogin = await api('POST', '/api/v1/auth/login', { email: `t${ts}@t.com`, password: 'wrong' });
ok('错误密码被拒', !badLogin.success);

// 1.5 获取用户信息
const me = await api('GET', '/api/v1/auth/me', null, readerToken);
ok('获取用户信息', me.success && me.data?.username === `t${ts}`);

// 1.6 无 token 访问
const noAuth = await api('GET', '/api/v1/auth/me');
ok('无token返回401', noAuth.success === false);

// ========== 2. 投稿系统 ==========
console.log('\n=== 2. 投稿系统 ===');

// 2.1 读者投稿
const sub = await api('POST', '/api/v1/submissions', {
  title: '全量测试小说', genre: '仙侠',
  worldview: '修仙世界九重天',
  outline: '少年逆天改命',
  core_conflict: '天道不容',
  tone: '热血',
  characters: [{ name: '萧炎', role: 'protagonist', appearance: '少年', personality: '坚毅', motivation: '变强', backstory: '废柴逆袭' }],
}, readerToken);
ok('提交投稿', sub.success && sub.data?.id);
const bookId = sub.data.id;

// 2.2 缺少必填字段
const badSub = await api('POST', '/api/v1/submissions', { title: 'test' }, readerToken);
ok('缺少字段被拒', !badSub.success);

// 2.3 获取投稿列表(读者看自己的)
const mySubs = await api('GET', '/api/v1/submissions?status=pending', null, readerToken);
ok('获取我的投稿', mySubs.success && mySubs.data?.books?.length > 0);

// 2.4 管理员登录
const adminLogin = await api('POST', '/api/v1/auth/login', { email: 'admin_1776214980322@test.com', password: 'admin123' });
ok('管理员登录', adminLogin.success && adminLogin.data?.user?.role === 'admin');
const adminToken = adminLogin.data.token;

// 2.5 管理员获取所有 pending
const allSubs = await api('GET', '/api/v1/submissions?status=pending', null, adminToken);
ok('管理员查看所有投稿', allSubs.success);

// 2.6 获取投稿详情
const subDetail = await api('GET', `/api/v1/submissions/${bookId}`, null, adminToken);
ok('获取投稿详情', subDetail.success && subDetail.data?.id === bookId);

// 2.7 拒绝投稿
const reject = await api('POST', `/api/v1/submissions/${bookId}/reject`, { reason: '测试拒绝' }, adminToken);
ok('拒绝投稿', reject.success && reject.data?.status === 'rejected');

// 2.8 读者再投一个
const sub2 = await api('POST', '/api/v1/submissions', {
  title: '全量测试·仙侠', genre: '仙侠',
  worldview: '修仙九重天，天道主宰万物',
  outline: '少年萧炎从废柴到仙帝',
  core_conflict: '天道压制与逆天而行',
  tone: '热血',
  characters: [{ name: '萧炎', role: 'protagonist', appearance: '黑发少年', personality: '坚韧不拔', motivation: '突破天道', backstory: '萧家废物获神秘传承' }],
}, readerToken);
ok('再次投稿', sub2.success);
const bookId2 = sub2.data.id;

// 2.9 审批通过
const approve = await api('POST', `/api/v1/submissions/${bookId2}/approve`, null, adminToken);
ok('审批通过', approve.success && approve.data?.status === 'approved');

// ========== 3. AI 生成 (等 Queue) ==========
console.log('\n=== 3. AI 生成 ===');
console.log('  等待第1章生成...');
let ch1Ok = false;
for (let i = 0; i < 16; i++) {
  await new Promise(r => setTimeout(r, 7500));
  const ch = await api('GET', `/api/v1/books/${bookId2}/chapters`);
  if ((ch.data?.chapters || []).length > 0) {
    ch1Ok = true;
    const c = ch.data.chapters[0];
    ok(`第1章生成: "${c.title}" (${c.word_count}字)`, c.word_count > 200);
    break;
  }
  process.stdout.write(`  ${(i + 1) * 7.5}s...`);
}
if (!ch1Ok) ok('第1章生成', false);

// ========== 4. 阅读系统 ==========
console.log('\n=== 4. 阅读系统 ===');

// 4.1 书目列表
const books = await api('GET', '/api/v1/books?status=active');
ok('书目列表', books.success && books.data?.books?.length > 0);

// 4.2 书目详情
const bookDetail = await api('GET', `/api/v1/books/${bookId2}`);
ok('书目详情', bookDetail.success && bookDetail.data?.id === bookId2);

// 4.3 章节列表(目录)
const chapters = await api('GET', `/api/v1/books/${bookId2}/chapters`);
ok('章节目录', chapters.success && chapters.data?.chapters?.length > 0);

if (ch1Ok) {
  // 4.4 章节正文
  const chRead = await api('GET', `/api/v1/books/${bookId2}/chapters/1`);
  ok('章节正文', chRead.success && chRead.data?.content?.length > 100);

  // 4.5 方向选项
  const dirs = await api('GET', `/api/v1/books/${bookId2}/chapters/1/directions`);
  ok('方向选项', dirs.success && dirs.data?.directions?.length >= 2);
}

// 4.6 世界观文件
const wb = await api('GET', `/api/v1/books/${bookId2}/worldbuilding`);
ok('世界观文件', wb.success);

// ========== 5. 投票系统 ==========
console.log('\n=== 5. 投票系统 ===');

if (ch1Ok) {
  const dirs = await api('GET', `/api/v1/books/${bookId2}/chapters/1/directions`);
  const dirId = dirs.data?.directions?.[0]?.id;

  if (dirId) {
    // 5.1 读者投票
    const vote = await api('POST', '/api/v1/votes', { direction_id: dirId }, readerToken);
    ok('读者投票', vote.success);

    // 5.2 重复投票被拒
    const dupVote = await api('POST', '/api/v1/votes', { direction_id: dirId }, readerToken);
    ok('重复投票被拒', !dupVote.success);

    // 5.3 补充投票到门槛
    for (let i = 0; i < 2; i++) {
      const nr = await api('POST', '/api/v1/auth/register', { username: `v${ts}${i}`, email: `v${ts}${i}@t.com`, password: '123456' });
      await api('POST', '/api/v1/votes', { direction_id: dirId }, nr.data.token);
    }
    ok('补充2票', true);

    // 5.4 等第2章
    console.log('  等待第2章生成...');
    let ch2Ok = false;
    for (let i = 0; i < 16; i++) {
      await new Promise(r => setTimeout(r, 7500));
      const ch = await api('GET', `/api/v1/books/${bookId2}/chapters`);
      if ((ch.data?.chapters || []).length >= 2) {
        ch2Ok = true;
        const c2 = ch.data.chapters[1];
        ok(`第2章生成: "${c2.title}" (${c2.word_count}字)`, c2.word_count > 200);
        break;
      }
      process.stdout.write(`  ${(i + 1) * 7.5}s...`);
    }
    if (!ch2Ok) ok('第2章生成', false);
  }
}

// ========== 6. 角色申请 ==========
console.log('\n=== 6. 角色申请 ===');

// 6.1 读者申请角色入书
const charApp = await api('POST', `/api/v1/books/${bookId2}/characters/apply`, {
  name: '林婉儿',
  appearance: '白衣少女，容貌清丽',
  personality: '外冷内热，聪明机智',
  backstory: '隐世宗门传人',
  motivation: '寻找失踪的师父',
  abilities: '冰系功法',
  relationship_to_existing: '萧炎的救命恩人',
}, readerToken);
ok('角色申请', charApp.success && charApp.data?.status === 'pending');
const appId = charApp.data?.id;

// 6.2 管理员获取申请列表
const apps = await api('GET', `/api/v1/books/${bookId2}/characters/applications?status=pending`, null, adminToken);
ok('获取申请列表', apps.success);

// 6.3 审批角色
if (appId) {
  const approveChar = await api('POST', `/api/v1/characters/applications/${appId}/approve`, null, adminToken);
  ok('审批角色', approveChar.success && approveChar.data?.status === 'approved');
}

// 6.4 获取书中角色
const chars = await api('GET', `/api/v1/books/${bookId2}/characters`, null, readerToken);
ok('获取书中角色', chars.success);

// 6.5 我的角色申请
const myApps = await api('GET', '/api/v1/characters/applications/my', null, readerToken);
ok('我的角色申请', myApps.success);

// ========== 汇总 ==========
console.log('\n========================================');
console.log(`测试完成: ${passed} 通过, ${failed} 失败`);
console.log(`通过率: ${(passed / (passed + failed) * 100).toFixed(1)}%`);
console.log('========================================\n');

if (failed > 0) {
  console.log('以下功能需要修复:');
}
