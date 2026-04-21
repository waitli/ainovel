const API_KEY = process.env.OPENROUTER_API_KEY;

if (!API_KEY) {
  throw new Error('OPENROUTER_API_KEY is required');
}

console.log('测试 gemini-3.1-flash-image...');
try {
  const r = await fetch('https://cpa.waitli.top/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gemini-3.1-flash-image',
      messages: [{ role: 'user', content: 'Generate a book cover for a Chinese fantasy novel called 星辰变' }],
      max_tokens: 4096,
    }),
  });
  const text = await r.text();
  console.log(`状态: ${r.status}`);
  console.log(`响应: ${text.slice(0, 800)}`);
} catch (e) {
  console.log(`错误: ${e.message}`);
}
