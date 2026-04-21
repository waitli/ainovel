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

// Get all books
const books = await api('GET', '/books?status=approved&limit=50', undefined, admin.token);
console.log(`Approved books: ${books.books?.length || 0}`);

// For each book, call orchestrator directly via the API gateway's internal routing
// The orchestrator has an HTTP endpoint at /init-book
for (const book of books.books || []) {
  const subData = JSON.parse(book.submission_data || '{}');
  const lang = subData.language || 'zh';
  console.log(`\nInit: ${book.title} [${lang}] (${book.id})`);
  
  try {
    // Call orchestrator through api-gateway (it routes to orchestrator service)
    // But api-gateway doesn't have a route for /init-book...
    // Let's call the orchestrator directly using wrangler dev or the service URL
    const res = await fetch(`https://ainovel-orchestrator.waitli.workers.dev/init-book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'INIT_BOOK',
        book_id: book.id,
        submission: subData,
      }),
      dispatcher: agent,
    });
    const result = await res.json();
    console.log(`  Result: ${JSON.stringify(result).slice(0, 100)}`);
  } catch(e) {
    console.log(`  Error: ${e.message}`);
  }
}

console.log('\nWaiting 30s for generation...');
await sleep(30000);

const activeBooks = await api('GET', '/books?status=active&limit=50', undefined, reader.token);
console.log(`\nActive books: ${activeBooks.books?.length || 0}`);
for (const b of activeBooks.books || []) {
  console.log(`  ${b.title}: ${b.current_chapter}ch`);
}
