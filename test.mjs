#!/usr/bin/env node
// ============================================
// AI Novel Platform — 基础功能测试
// 在本地运行: node test.mjs
// ============================================

const BASE = 'https://ainovel-api.waitli.workers.dev';
const PROXY = 'http://172.20.224.1:8080'; // 系统代理

// 带代理的 fetch
const { ProxyAgent } = await import('undici');
const dispatcher = new ProxyAgent({ uri: PROXY });

async function api(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const resp = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    dispatcher,
  });
  const data = await resp.json();
  return { status: resp.status, data };
}

async function main() {
  console.log('=== AI Novel Platform 基础测试 ===\n');

  // 1. 健康检查
  console.log('1. 健康检查...');
  const health = await api('GET', '/api/health');
  console.log(`   状态: ${health.status}`);
  console.log(`   响应: ${JSON.stringify(health.data)}\n`);

  // 2. 注册用户
  console.log('2. 注册测试读者...');
  const email = `test_${Date.now()}@test.com`;
  const reg = await api('POST', '/api/v1/auth/register', {
    username: `reader_${Date.now()}`,
    email,
    password: 'test123456',
  });
  console.log(`   状态: ${reg.status}`);
  console.log(`   响应: ${JSON.stringify(reg.data, null, 2)}\n`);
  
  const readerToken = reg.data?.data?.token;
  if (!readerToken) {
    console.log('   注册失败，跳过后续测试');
    return;
  }

  // 3. 登录
  console.log('3. 登录测试...');
  const login = await api('POST', '/api/v1/auth/login', { email, password: 'test123456' });
  console.log(`   状态: ${login.status}`);
  console.log(`   Token: ${login.data?.data?.token?.substring(0, 20)}...\n`);

  // 4. 获取用户信息
  console.log('4. 获取用户信息...');
  const me = await api('GET', '/api/v1/auth/me', null, readerToken);
  console.log(`   状态: ${me.status}`);
  console.log(`   用户: ${JSON.stringify(me.data?.data, null, 2)}\n`);

  // 5. 提交投稿
  console.log('5. 提交新书投稿...');
  const submission = await api('POST', '/api/v1/submissions', {
    title: '测试小说：剑道独尊',
    genre: '玄幻',
    worldview: '天元大陆，武者为尊。修炼体系分九境：淬体、通脉、凝元、化神、洞虚、渡劫、大乘、飞升、永恒。大陆上有四大宗门、三大帝国鼎立，暗流涌动。',
    outline: '少年林辰意外获得上古传承，从废物逆袭为绝世天才，一路碾压天骄，最终踏上武道巅峰。',
    core_conflict: '林辰体内封印着上古魔神之力，正道不容，魔道觊觎，他必须在夹缝中成长。',
    tone: '热血爽文',
    characters: [{
      name: '林辰',
      role: 'protagonist',
      appearance: '十六岁少年，相貌清秀，眼神坚毅，右臂有神秘纹路',
      personality: '坚韧不拔，重情重义，外表冷淡内心热血',
      motivation: '查明父母失踪真相，保护身边的人，追求武道极致',
      backstory: '青云城林家废柴少爷，三年前父母失踪后受尽欺凌，意外觉醒上古传承',
    }],
  }, readerToken);
  console.log(`   状态: ${submission.status}`);
  console.log(`   投稿ID: ${submission.data?.data?.id}\n`);

  // 6. 获取投稿列表
  console.log('6. 获取投稿列表...');
  const list = await api('GET', '/api/v1/submissions?status=pending', null, readerToken);
  console.log(`   状态: ${list.status}`);
  console.log(`   投稿数量: ${list.data?.data?.books?.length || 0}\n`);

  // 7. 获取书目列表 (公开)
  console.log('7. 获取书目列表...');
  const books = await api('GET', '/api/v1/books?status=active');
  console.log(`   状态: ${books.status}`);
  console.log(`   书目数量: ${books.data?.data?.books?.length || 0}\n`);

  console.log('=== 基础测试完成 ===');
  console.log('\n下一步:');
  console.log('1. 用管理员账号审批投稿 → 触发AI生成第一章');
  console.log('2. 读者投票选择方向 → 触发第二章生成');
  console.log('\n创建管理员:');
  console.log(`   UPDATE users SET role = 'admin' WHERE email = '${email}';`);
}

main().catch(console.error);
