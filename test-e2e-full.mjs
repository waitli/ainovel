// ============================================
// AI Novel Platform — 完整端到端测试
// ============================================

const BASE = 'https://ainovel-api.waitli.workers.dev';
const PROXY = 'http://172.20.224.1:8080';
const { ProxyAgent } = await import('undici');
const dispatcher = new ProxyAgent({ uri: PROXY });

async function api(method, path, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, {
    method, headers: h,
    body: body && JSON.stringify(body),
    dispatcher,
  });
  return r.json();
}

const ts = Date.now();

// ===== Phase 1: 用户系统 =====
console.log('=== Phase 1: 用户系统 ===\n');

// 注册管理员
console.log('1. 注册管理员...');
const adminReg = await api('POST', '/api/v1/auth/register', {
  username: `admin_${ts}`, email: `admin_${ts}@test.com`, password: 'admin123'
});
const adminToken = adminReg.data?.token;
const adminId = adminReg.data?.user?.id;
console.log(`   ✅ ${adminReg.data?.user?.username} (${adminReg.data?.user?.role})`);

// 注册读者
console.log('2. 注册读者...');
const readerReg = await api('POST', '/api/v1/auth/register', {
  username: `reader_${ts}`, email: `reader_${ts}@test.com`, password: '123456'
});
const readerToken = readerReg.data?.token;
console.log(`   ✅ ${readerReg.data?.user?.username}`);

// ===== Phase 2: 升级管理员 =====
console.log('\n=== Phase 2: 升级管理员 (D1直接操作) ===\n');
// 需要通过 wrangler 执行 SQL
console.log('   需要执行 SQL 升级管理员...');
console.log(`   管理员ID: ${adminId}`);
console.log(`   管理员邮箱: admin_${ts}@test.com`);

// 退出提示用户手动操作
console.log('\n   >>> 请在另一终端执行:');
console.log(`   npx wrangler d1 execute ainovel-db --remote --command="UPDATE users SET role='admin' WHERE id='${adminId}'"`);
console.log('   >>> 执行完毕后按回车继续测试...');
process.stdin.resume();
await new Promise(r => process.stdin.once('data', r));
process.stdin.pause();

// 管理员重新登录
console.log('\n3. 管理员重新登录...');
const adminLogin = await api('POST', '/api/v1/auth/login', {
  email: `admin_${ts}@test.com`, password: 'admin123'
});
const adminToken2 = adminLogin.data?.token;
console.log(`   ✅ 角色: ${adminLogin.data?.user?.role}`);

// ===== Phase 3: 投稿 =====
console.log('\n=== Phase 3: 读者投稿 ===\n');
console.log('4. 提交新书《万古武帝》...');
const sub = await api('POST', '/api/v1/submissions', {
  title: '万古武帝',
  genre: '玄幻',
  worldview: '苍穹大陆，武者为尊。武道九境：淬体、通脉、凝元、化神、洞虚、渡劫、大乘、飞升、永恒。三大圣地五大宗门掌控大陆，北方蛮荒妖兽横行，西方深渊封印上古魔族。',
  outline: '少年叶尘偶得《太古经》传承，从废物逆袭为绝世天才，一路碾压天骄，最终踏上武道巅峰。他闯秘境、战天骄、破阴谋，最终成就万古武帝。',
  core_conflict: '叶尘体内的《太古经》引来三大圣地觊觎，同时他的身世牵扯上古大战隐秘。正邪两道都想利用他，他必须在夹缝中变强。',
  tone: '热血爽文，节奏明快',
  characters: [{
    name: '叶尘', role: 'protagonist',
    appearance: '十七岁少年，修长身材，眉宇坚毅，右臂神秘黑色纹路',
    personality: '冷静睿智，杀伐果断，对敌人冷酷，对朋友重情',
    motivation: '找到失踪父母，守护身边之人，追求武道极致',
    backstory: '青阳城叶家旁系子弟，六岁时父母在变故中失踪，被视为废物冷落十年',
  }],
}, readerToken);
const bookId = sub.data?.id;
console.log(`   ✅ 投稿ID: ${bookId} 状态: ${sub.data?.status}`);

// ===== Phase 4: 审批 → AI生成 =====
console.log('\n=== Phase 4: 审批 → AI生成第一章 ===\n');
console.log('5. 管理员审批通过...');
const approve = await api('POST', `/api/v1/submissions/${bookId}/approve`, null, adminToken2);
console.log(`   结果: ${JSON.stringify(approve).slice(0, 150)}`);

// 轮询等待
console.log('\n6. 等待AI生成 (3分钟)...');
let chapterFound = false;
for (let i = 0; i < 24; i++) {
  await new Promise(r => setTimeout(r, 7500));
  const ch = await api('GET', `/api/v1/books/${bookId}/chapters`);
  const chapters = ch.data?.chapters || [];
  if (chapters.length > 0) {
    chapterFound = true;
    console.log(`\n   ✅ 第一章生成成功!`);
    console.log(`   标题: ${chapters[0].title}`);
    console.log(`   字数: ${chapters[0].word_count}`);

    // 读取正文
    const read = await api('GET', `/api/v1/books/${bookId}/chapters/1`);
    const content = read.data?.content || '';
    console.log(`\n   --- 正文预览 ---\n   ${content.slice(0, 400).replace(/\n/g, '\n   ')}\n   ---`);

    // 方向选项
    const dirs = await api('GET', `/api/v1/books/${bookId}/chapters/1/directions`);
    const directions = dirs.data?.directions || [];
    console.log(`\n   方向选项 (${directions.length}个):`);
    directions.forEach(d => console.log(`     方向${d.direction_number}: ${d.title}`));

    // 投票
    if (directions.length > 0) {
      console.log(`\n7. 读者投票...`);
      const vote = await api('POST', '/api/v1/votes', { direction_id: directions[0].id }, readerToken);
      console.log(`   结果: ${JSON.stringify(vote).slice(0, 150)}`);
    }
    break;
  }
  process.stdout.write(`   ${(i + 1) * 7.5}s ...`);
}

if (!chapterFound) {
  console.log('\n   ⚠️ 超时，AI未返回结果');
  console.log('   请检查 orchestrator 日志: npx wrangler tail -c workers/orchestrator/wrangler.toml');
}

console.log('\n\n=== 测试结束 ===');
