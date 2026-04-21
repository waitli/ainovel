// 测试 AI API 可达性
const PROXY = 'http://172.20.224.1:8080';
const { ProxyAgent } = await import('undici');
const d = new ProxyAgent({ uri: PROXY });
const API_KEY = process.env.OPENROUTER_API_KEY;

if (!API_KEY) {
  throw new Error('OPENROUTER_API_KEY is required');
}

console.log('测试 OpenRouter API...');
try {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'openrouter/free',
      messages: [{ role: 'user', content: 'Say hello in 5 words' }],
      max_tokens: 50,
    }),
    dispatcher: d,
  });
  console.log(`状态: ${r.status}`);
  const text = await r.text();
  console.log(`响应: ${text.slice(0, 300)}`);
} catch (e) {
  console.log(`错误: ${e.message}`);
}
