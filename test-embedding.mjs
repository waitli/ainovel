// 测试 Workers AI Embedding
const ORCH = 'https://ainovel-orchestrator.waitli.workers.dev';
const PROXY = 'http://172.20.224.1:8080';
const { ProxyAgent } = await import('undici');
const d = new ProxyAgent({ uri: PROXY });

// 直接调用 Workers AI API 测试
const ACCOUNT_ID = '9a89dfd8acd8946a17ab969d59bef574';
const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/@cf/baai/bge-base-en-v1.5`;

console.log('测试 Workers AI Embedding...');
try {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: ['测试文本', '角色：叶尘是一个坚毅的少年'] }),
    dispatcher: d,
  });
  const j = await r.json();
  console.log(`状态: ${r.status}`);
  if (j.result?.data) {
    console.log(`✅ Embedding 维度: ${j.result.data[0].length}`);
    console.log(`   前5个值: ${j.result.data[0].slice(0, 5).map((v) => v.toFixed(4)).join(', ')}`);
  } else {
    console.log(`响应: ${JSON.stringify(j).slice(0, 300)}`);
  }
} catch (e) {
  console.log(`错误: ${e.message}`);
}
