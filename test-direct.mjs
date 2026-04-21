// 不走代理直连测试
const API_KEY = process.env.OPENROUTER_API_KEY;

if (!API_KEY) {
  throw new Error('OPENROUTER_API_KEY is required');
}

console.log('直连测试...');
try {
  const r = await fetch('https://cpa.waitli.top/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-5.4-mini',
      messages: [{ role: 'user', content: '你好' }],
      max_tokens: 50,
    }),
  });
  const j = await r.json();
  console.log(`状态: ${r.status}`);
  console.log(`响应: ${JSON.stringify(j).slice(0, 300)}`);
} catch (e) {
  console.log(`错误: ${e.message}`);
}
