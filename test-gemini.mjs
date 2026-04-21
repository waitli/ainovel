const PROXY = 'http://172.20.224.1:8080';
const { ProxyAgent } = await import('undici');
const d = new ProxyAgent({ uri: PROXY });
const API_KEY = process.env.OPENROUTER_API_KEY;

if (!API_KEY) {
  throw new Error('OPENROUTER_API_KEY is required');
}

console.log('测试 Gemini 图片生成...');
try {
  const r = await fetch('https://cpa.waitli.top/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gemini-2.0-flash-exp',
      messages: [{ role: 'user', content: 'Generate a book cover image for a fantasy novel called "星辰变". Chinese martial arts fantasy style, dark purple and gold tones.' }],
      max_tokens: 4096,
    }),
    dispatcher: d,
  });
  const j = await r.json();
  console.log(`状态: ${r.status}`);
  console.log(`模型: ${j.model || 'unknown'}`);

  // 检查响应格式
  const msg = j.choices?.[0]?.message;
  if (msg) {
    console.log(`Content type: ${typeof msg.content}`);
    if (typeof msg.content === 'string') {
      console.log(`Content preview: ${msg.content.slice(0, 200)}`);
      if (msg.content.startsWith('data:image')) {
        console.log('✅ 包含 base64 图片!');
      }
    } else if (Array.isArray(msg.content)) {
      console.log(`Content parts: ${msg.content.length}`);
      msg.content.forEach((p, i) => console.log(`  Part ${i}: ${JSON.stringify(p).slice(0, 100)}`));
    }
  } else {
    console.log(`Full response: ${JSON.stringify(j).slice(0, 500)}`);
  }
} catch (e) {
  console.log(`错误: ${e.message}`);
}
