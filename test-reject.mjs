const BASE = 'https://ainovel-api.waitli.workers.dev';
const PROXY = 'http://172.20.224.1:8080';
const { ProxyAgent } = await import('undici');
const d = new ProxyAgent({ uri: PROXY });

async function api(m, p, b, t) {
  const h = { 'Content-Type': 'application/json' };
  if (t) h['Authorization'] = `Bearer ${t}`;
  const r = await fetch(`${BASE}${p}`, { method: m, headers: h, body: b && JSON.stringify(b), dispatcher: d });
  return r.json();
}

const login = await api('POST', '/api/v1/auth/login', { email: 'admin_1776214980322@test.com', password: 'admin123' });
const at = login.data?.token;
const rr = await api('POST', '/api/v1/auth/register', { username: `rj${Date.now()}`, email: `rj${Date.now()}@t.com`, password: '123456' });
const rt = rr.data?.token;

const sub = await api('POST', '/api/v1/submissions', {
  title: '拒绝测试', genre: '玄幻', worldview: 'w', outline: 'o', core_conflict: 'c',
  characters: [{ name: 'a', role: 'protagonist', appearance: 'a', personality: 'a', motivation: 'a', backstory: 'a' }],
}, rt);
console.log('投稿:', JSON.stringify(sub).slice(0, 100));

const rej = await api('POST', `/api/v1/submissions/${sub.data.id}/reject`, { reason: '测试' }, at);
console.log('拒绝:', JSON.stringify(rej));
