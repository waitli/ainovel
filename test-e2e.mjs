// ============================================
// 端到端测试: 注册→设管理员→审批→AI生成第一章
// ============================================

const BASE = 'https://ainovel-api.waitli.workers.dev';
const PROXY = 'http://172.20.224.1:8080';

const { ProxyAgent } = await import('undici');
const dispatcher = new ProxyAgent({ uri: PROXY });

async function api(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const resp = await fetch(`${BASE}${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
    dispatcher,
  });
  const data = await resp.json();
  return { status: resp.status, data };
}

async function main() {
  console.log('=== AI Novel 端到端测试 ===\n');
  const ts = Date.now();

  // 1. 注册管理员账号
  console.log('1. 注册管理员...');
  const adminEmail = `admin_${ts}@test.com`;
  const adminReg = await api('POST', '/api/v1/auth/register', {
    username: `admin_${ts}`, email: adminEmail, password: 'admin123'
  });
  console.log(`   用户: ${adminReg.data.data?.user?.username}`);
  console.log(`   角色: ${adminReg.data.data?.user?.role} (需要升级为admin)`);
  const adminToken = adminReg.data.data?.token;

  // 2. 注册读者
  console.log('\n2. 注册读者...');
  const readerReg = await api('POST', '/api/v1/auth/register', {
    username: `reader_${ts}`, email: `reader_${ts}@test.com`, password: '123456'
  });
  const readerToken = readerReg.data.data?.token;
  console.log(`   用户: ${readerReg.data.data?.user?.username}`);

  // 3. 读者提交投稿
  console.log('\n3. 读者提交新书投稿...');
  const sub = await api('POST', '/api/v1/submissions', {
    title: '万古武帝',
    genre: '玄幻',
    worldview: '苍穹大陆，强者为尊。武道境界分为：淬体、通脉、凝元、化神、洞虚、渡劫、大乘、飞升、永恒九大境界。大陆由三大圣地、五大宗门掌控，散修艰难生存。北方蛮荒有妖兽横行，西方深渊封印着上古魔族。',
    outline: '少年叶尘偶得上古大帝传承《太古经》，从被人嘲笑的废物一步步崛起。他闯秘境、战天骄、破阴谋，最终揭开父母失踪真相，打破天地桎梏，成就万古武帝。',
    core_conflict: '叶尘体内的《太古经》引来了三大圣地的觊觎，同时他的身世之谜牵扯到一场上古大战的隐秘。正邪两道都想利用他，他必须在夹缝中变强。',
    tone: '热血爽文，节奏明快',
    target_chapters: 40,
    characters: [{
      name: '叶尘',
      role: 'protagonist',
      appearance: '十七岁少年，身材修长，眉宇间透着坚毅，右臂有神秘黑色纹路',
      personality: '冷静睿智，杀伐果断，对敌人冷酷，对朋友重情重义',
      motivation: '找到失踪的父母，守护身边之人，追求武道极致',
      backstory: '青阳城叶家旁系子弟，六岁时父母在一场变故中失踪，被家族视为废物冷落十年。意外在后山禁地获得《太古经》传承',
    }, {
      name: '苏沐雪',
      role: 'supporting',
      appearance: '十八岁少女，容貌绝美，气质清冷如雪',
      personality: '外冷内热，表面高傲实则善良',
      motivation: '振兴家族，守护弟弟',
      backstory: '苏家大小姐，与叶尘青梅竹马，是叶家唯一对叶尘好的人',
    }, {
      name: '赵天阳',
      role: 'antagonist',
      appearance: '二十岁青年，面容俊朗但眼神阴鸷',
      personality: '心胸狭隘，嫉妒心强，表面正人君子实则不择手段',
      motivation: '成为青阳城第一天才，得到叶尘的传承',
      backstory: '青阳城赵家嫡子，被誉为第一天才，叶尘崛起后处处与他作对',
    }],
  }, readerToken);
  const bookId = sub.data.data?.id;
  console.log(`   投稿ID: ${bookId}`);
  console.log(`   状态: ${sub.data.data?.status}`);

  // 4. 把管理员升级为 admin (直接调 D1)
  console.log('\n4. 设置管理员角色...');
  console.log('   (需要通过 wrangler d1 执行 SQL)');

  // 退出，让用户手动执行 SQL 升级管理员
  console.log('\n=== 需要手动操作 ===');
  console.log('请在另一个终端执行:');
  console.log(`\nnpx wrangler d1 execute ainovel-db --remote --command="UPDATE users SET role='admin' WHERE email='${adminEmail}'"`);
  console.log('\n然后回来继续测试审批流程。');
}

main().catch(console.error);
