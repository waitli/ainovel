import { ProxyAgent } from 'undici';
const agent = new ProxyAgent('http://172.20.224.1:8080');
const API = 'https://api.ainovel.waitli.top/api/v1';
const h = (t) => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` });
async function api(method, path, body, t) {
  const r = await fetch(`${API}${path}`, { method, headers: h(t), body: body && JSON.stringify(body), dispatcher: agent });
  const d = await r.json();
  if (!d.success) throw new Error(`${path}: ${d.error}`);
  return d.data;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const admin = await api('POST', '/auth/login', { email: 'a1776314387836@test.com', password: 'test123456' });
const reader = await api('POST', '/auth/login', { email: 'r1776314387836@test.com', password: 'test123456' });

const subs = await api('GET', '/submissions?status=pending', undefined, admin.token);
console.log(`Pending: ${subs.books?.length || 0}`);

for (const book of subs.books || []) {
  console.log(`Approving: ${book.title}...`);
  await api('POST', `/submissions/${book.id}/approve`, {}, admin.token);
}

console.log('\nWaiting 40s for AI generation...');
await sleep(40000);

const books = await api('GET', '/books?status=active&limit=50', undefined, reader.token);
console.log(`\nActive books: ${books.books?.length || 0}`);
for (const b of books.books || []) {
  console.log(`  ${b.title} [${b.language || '?'}]: ${b.current_chapter}ch, ${b.total_words}w`);
}
