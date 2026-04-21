// 测试自定义域名 API
const PROXY = 'http://172.20.224.1:8080';
const { ProxyAgent } = await import('undici');
const d = new ProxyAgent({ uri: PROXY });

async function test(url, label) {
  try {
    const r = await fetch(url, { dispatcher: d });
    const text = await r.text();
    console.log(`${label}: ${r.status} ${text.slice(0, 150)}`);
  } catch (e) {
    console.log(`${label}: ❌ ${e.message}`);
  }
}

// 测试各个域名
await test('https://api.ainovel.waitli.top/api/health', 'API Gateway');
await test('https://api.ainovel.waitli.top/api/v1/books?status=active', '书籍列表');
await test('https://ainovel-api.waitli.workers.dev/api/health', 'Workers域名');
await test('https://ainovel.waitli.top', '前端页面');
