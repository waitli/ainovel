const API_KEY = process.env.OPENROUTER_API_KEY;

if (!API_KEY) {
  throw new Error('OPENROUTER_API_KEY is required');
}

console.log('测试 Gemini 图片 (直连)...');
try {
  const r = await fetch('https://cpa.waitli.top/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gemini-2.0-flash-exp',
      messages: [{ role: 'user', content: 'Generate a book cover image for a fantasy novel called 星辰变' }],
      max_tokens: 4096,
    }),
  });
  const j = await r.json();
  console.log(`状态: ${r.status}`);
  console.log(`响应: ${JSON.stringify(j).slice(0, 500)}`);
} catch (e) {
  console.log(`错误: ${e.message}`);
}
