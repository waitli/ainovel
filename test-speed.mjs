const PROXY = 'http://172.20.224.1:8080';
const { ProxyAgent } = await import('undici');
const d = new ProxyAgent({ uri: PROXY });
const API_KEY = process.env.OPENROUTER_API_KEY;

if (!API_KEY) {
  throw new Error('OPENROUTER_API_KEY is required');
}

console.log('测试 gpt-5.4-mini 速度...\n');

for (let i = 0; i < 3; i++) {
  const t0 = Date.now();
  const r = await fetch('https://cpa.waitli.top/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-5.4-mini',
      messages: [{ role: 'user', content: '用一句话介绍你自己' }],
      max_tokens: 100,
    }),
    dispatcher: d,
  });
  const j = await r.json();
  const ms = Date.now() - t0;
  console.log(`${i + 1}. ${ms}ms | ${j.choices?.[0]?.message?.content?.slice(0, 60) || j.error?.message || 'error'}`);
}

console.log('\n测试章节生成速度...\n');
const t0 = Date.now();
const r = await fetch('https://cpa.waitli.top/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  },
  body: JSON.stringify({
    model: 'gpt-5.4-mini',
    messages: [
      { role: 'system', content: '你是中文小说作家' },
      { role: 'user', content: '写一个玄幻小说第一章开头，200字，主角叶尘发现太古经碎片' }
    ],
    max_tokens: 500,
  }),
  dispatcher: d,
});
const j = await r.json();
const ms = Date.now() - t0;
console.log(`章节生成: ${ms}ms (${(ms/1000).toFixed(1)}s)`);
console.log(`内容: ${j.choices?.[0]?.message?.content?.slice(0, 200) || 'error'}`);
