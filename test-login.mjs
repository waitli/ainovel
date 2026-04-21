import { ProxyAgent } from 'undici';
const agent = new ProxyAgent('http://172.20.224.1:8080');
const API = 'https://api.ainovel.waitli.top/api/v1';

console.log('Testing login...');
try {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'n1776325916530@ink.com', password: 'create2026' }),
    dispatcher: agent,
  });
  console.log(`Status: ${r.status}`);
  const d = await r.json();
  console.log(`Result: ${d.success ? 'OK' : d.error}`);
  if (d.data?.token) console.log(`Token: ${d.data.token.slice(0, 20)}...`);
} catch(e) {
  console.log(`Error: ${e.message}`);
}
