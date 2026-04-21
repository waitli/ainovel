#!/usr/bin/env node
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
  const ts = Date.now();
  console.log('=== AI Novel 快速测试 ===\n');

  // 1. 管理员登录
  console.log('1. 管理员登录...');
  const login = await api('POST', '/api/v1/auth/login', {
    email: 'admin_1776214980322@test.com', password: 'admin123'
  });
  const at = login.data?.data?.token;
  console.log(`   状态: ${login.status} 角色: ${login.data?.data?.user?.role}\n`);

  // 2. 注册读者
  console.log('2. 注册读者...');
  const rr = await api('POST', '/api/v1/auth/register', {
    username: `reader_${ts}`, email: `reader_${ts}@t.com`, password: '123456'
  });
  const rt = rr.data?.data?.token;
  console.log(`   状态: ${rr.status} 用户: ${rr.data?.data?.user?.username}\n`);

  // 3. 投稿
  console.log('3. 投稿《万古武帝》...');
  const sub = await api('POST', '/api/v1/submissions', {
    title: '万古武帝', genre: '玄幻',
    worldview: '苍穹大陆武者为尊，武道九境：淬体通脉凝元化神洞虚渡劫大乘飞升永恒。三大圣地五大宗门掌控。',
    outline: '少年叶尘偶得太古经传承，从废物逆袭，碾压天骄，成就万古武帝。',
    core_conflict: '叶尘体内太古经引三大圣地觊觎，正邪都想利用他。',
    tone: '热血爽文',
    characters: [{ name: '叶尘', role: 'protagonist', appearance: '十七岁少年', personality: '冷静睿智', motivation: '武道极致', backstory: '叶家废物获太古经传承' }],
  }, rt);
  const bid = sub.data?.data?.id;
  console.log(`   状态: ${sub.status} ID: ${bid} (${sub.data?.data?.status})\n`);

  // 4. 审批
  console.log('4. 审批通过...');
  const ap = await api('POST', `/api/v1/submissions/${bid}/approve`, null, at);
  console.log(`   状态: ${ap.status} ${JSON.stringify(ap.data).slice(0, 120)}\n`);

  // 5. 轮询等AI
  console.log('5. 等待AI生成 (3分钟)...');
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 7500));
    const ch = await api('GET', `/api/v1/books/${bid}/chapters`);
    const chapters = ch.data?.data?.chapters || [];
    if (chapters.length > 0) {
      console.log(`\n   ✅ 第一章: ${chapters[0].title} (${chapters[0].word_count}字)`);

      const read = await api('GET', `/api/v1/books/${bid}/chapters/1`);
      const content = read.data?.data?.content || '';
      console.log(`\n--- 正文预览 ---\n${content.slice(0, 500)}\n---`);

      const dirs = await api('GET', `/api/v1/books/${bid}/chapters/1/directions`);
      const directions = dirs.data?.data?.directions || [];
      console.log(`\n--- 方向选项 (${directions.length}个) ---`);
      directions.forEach(d => console.log(`  ${d.direction_number}. ${d.title}`));

      if (directions.length > 0) {
        console.log('\n6. 读者投票...');
        const v = await api('POST', '/api/v1/votes', { direction_id: directions[0].id }, rt);
        console.log(`   ${JSON.stringify(v.data).slice(0, 120)}`);
      }
      console.log('\n=== 完成 ===');
      return;
    }
    process.stdout.write(`   ${(i + 1) * 7.5}s ...`);
  }
  console.log('\n   ⚠️ 超时，请检查 orchestrator 日志');
}

main().catch(e => console.error('Error:', e));
