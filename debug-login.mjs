const PROXY = 'http://172.20.224.1:8080';
const { ProxyAgent } = await import('undici');
const d = new ProxyAgent({ uri: PROXY });

// 登录
const r = await fetch('https://ainovel-api.waitli.workers.dev/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin_1776214980322@test.com', password: 'admin123' }),
  dispatcher: d
});
const j = await r.json();
console.log('Full response:', JSON.stringify(j, null, 2));
console.log('Token:', j?.data?.token?.slice(0, 30));
