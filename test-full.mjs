// ============================================
// 完整端到端测试
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

// 注册管理员
console.log('1. 注册管理员...');
const adminReg = await api('POST', '/api/v1/auth/register', {
  username: `admin_${ts}`, email: `admin_${ts}@test.com`, password: 'admin123'
});
const adminToken = adminReg.data?.token;
console.log(`   OK: ${adminReg.data?.user?.username}`);

// 注册读者
console.log('2. 注册读者...');
const readerReg = await api('POST', '/api/v1/auth/register', {
  username: `reader_${ts}`, email: `reader_${ts}@test.com`, password: '123456'
});
const readerToken = readerReg.data?.token;
console.log(`   OK: ${readerReg.data?.user?.username}`);

// 读者投稿
console.log('3. 读者投稿...');
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
    backstory: '青阳城叶家旁系子弟，六岁时父母在变故中失踪，被视为废物冷落十年。意外获《太古经》传承',
  }],
}, readerToken);
const bookId = sub.data?.id;
console.log(`   OK: ${bookId} (${sub.data?.status})`);

// 用 wrangler 升级管理员 (这个测试脚本里没法直接改D1)
// 请在另一个终端执行:
// npx wrangler d1 execute ainovel-db --remote --command="UPDATE users SET role='admin' WHERE email='admin_${ts}@test.com'"
console.log(`\n   >>> 请在另一终端执行: npx wrangler d1 execute ainovel-db --remote --command="UPDATE users SET role='admin' WHERE email='admin_${ts}@test.com'"`);
console.log('   >>> 然后按回车继续...');
process.stdin.resume();
await new Promise(r => process.stdin.once('data', r));

// 管理员重新登录获取admin权限的token
console.log('\n4. 管理员重新登录...');
const adminLogin = await api('POST', '/api/v1/auth/login', {
  email: `admin_${ts}@test.com`, password: 'admin123'
});
const adminToken2 = adminLogin.data?.token;
console.log(`   角色: ${adminLogin.data?.user?.role}`);

// 审批
console.log('5. 审批投稿...');
const approve = await api('POST', `/api/v1/submissions/${bookId}/approve`, null, adminToken2);
console.log(`   状态: ${JSON.stringify(approve).slice(0, 200)}`);

// 轮询等待第一章
console.log('\n6. 等待AI生成第一章 (最多3分钟)...');
for (let i = 0; i < 24; i++) {
  await new Promise(r => setTimeout(r, 7500));
  const ch = await api('GET', `/api/v1/books/${bookId}/chapters`);
  const chapters = ch.data?.chapters || [];
  if (chapters.length > 0) {
    console.log(`\n   ✅ 第一章生成成功!`);
    console.log(`   标题: ${chapters[0].title}`);
    console.log(`   字数: ${chapters[0].word_count}`);

    // 读取正文
    const read = await api('GET', `/api/v1/books/${bookId}/chapters/1`);
    const content = read.data?.content || '';
    console.log(`\n   正文预览 (前500字):\n${content.slice(0, 500)}...\n`);

    // 方向选项
    const dirs = await api('GET', `/api/v1/books/${bookId}/chapters/1/directions`);
    const directions = dirs.data?.directions || [];
    console.log(`   方向选项 (${directions.length}个):`);
    directions.forEach(d => console.log(`   - 方向${d.direction_number}: ${d.title}`));
    break;
  }
  process.stdout.write(`   ${(i + 1) * 7.5}s... `);
}

console.log('\n=== 测试完成 ===');
