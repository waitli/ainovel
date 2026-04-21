// ============================================
// 测试: 管理员审批 → AI生成第一章
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

// 简单轮询
async function poll(fn, label, maxWait = 120000, interval = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const result = await fn();
    console.log(`   [${label}] ${(Date.now() - start) / 1000}s - ${JSON.stringify(result.data).slice(0, 100)}`);
    if (result.data?.data?.books?.length > 0 || result.data?.data?.chapters?.length > 0) {
      return result;
    }
    await new Promise(r => setTimeout(r, interval));
  }
  return null;
}

async function main() {
  console.log('=== 审批 → AI生成测试 ===\n');
  const ts = Date.now();

  // 1. 管理员登录
  console.log('1. 管理员登录...');
  const login = await api('POST', '/api/v1/auth/login', {
    email: 'admin_1776214980322@test.com', password: 'admin123'
  });
  const adminToken = login.data.data?.token;
  console.log(`   Token: ${adminToken?.slice(0, 30)}...`);
  console.log(`   角色: ${login.data.data?.user?.role}\n`);

  // 2. 获取待审批投稿
  console.log('2. 获取待审批投稿...');
  const subs = await api('GET', '/api/v1/submissions?status=pending', null, adminToken);
  const pendingBooks = subs.data?.data?.books || [];
  console.log(`   待审批数量: ${pendingBooks.length}`);

  if (pendingBooks.length === 0) {
    console.log('   没有待审批的投稿，跳过');
    return;
  }

  const bookId = pendingBooks[0].id;
  console.log(`   审批书目: ${pendingBooks[0].title} (${bookId})\n`);

  // 3. 审批通过 → 触发 Queue → Orchestrator 生成第一章
  console.log('3. 审批通过 (触发AI生成)...');
  const approve = await api('POST', `/api/v1/submissions/${bookId}/approve`, null, adminToken);
  console.log(`   状态: ${approve.status}`);
  console.log(`   响应: ${JSON.stringify(approve.data)}\n`);

  // 4. 轮询等待第一章生成
  console.log('4. 等待AI生成第一章 (最多2分钟)...');
  const result = await poll(
    () => api('GET', `/api/v1/books/${bookId}/chapters`),
    '轮询',
    120000,
    8000
  );

  if (result) {
    const chapters = result.data?.data?.chapters || [];
    console.log(`\n✅ 第一章生成成功!`);
    console.log(`   章节: ${chapters[0]?.title}`);
    console.log(`   字数: ${chapters[0]?.word_count}`);

    // 5. 读取第一章正文
    console.log('\n5. 读取第一章正文...');
    const chapter = await api('GET', `/api/v1/books/${bookId}/chapters/1`);
    const content = chapter.data?.data?.content || '';
    console.log(`   正文长度: ${content.length} 字`);
    console.log(`   正文预览:\n${content.slice(0, 500)}...\n`);

    // 6. 获取方向选项
    console.log('6. 获取方向选项...');
    const dirs = await api('GET', `/api/v1/books/${bookId}/chapters/1/directions`);
    const directions = dirs.data?.data?.directions || [];
    console.log(`   方向数量: ${directions.length}`);
    directions.forEach(d => {
      console.log(`   - ${d.title}: ${d.description?.slice(0, 50)}...`);
    });

    // 7. 读者投票
    if (directions.length > 0) {
      console.log('\n7. 读者投票...');
      // 先注册/登录读者
      const readerLogin = await api('POST', '/api/v1/auth/login', {
        email: `reader_${1776214980322}@test.com`, password: '123456'
      });
      const readerToken = readerLogin.data.data?.token;

      const vote = await api('POST', '/api/v1/votes', {
        direction_id: directions[0].id
      }, readerToken);
      console.log(`   投票结果: ${JSON.stringify(vote.data)}`);
    }
  } else {
    console.log('\n⚠️ 2分钟内未生成完成，可能AI调用较慢或有错误');
    console.log('   请检查 orchestrator 的 wrangler tail 日志');
  }

  console.log('\n=== 测试结束 ===');
}

main().catch(console.error);
