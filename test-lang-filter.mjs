// Test API lang filter with proxy
import { ProxyAgent } from 'undici';
const agent = new ProxyAgent('http://172.20.224.1:8080');

const BASE = 'https://api.ainovel.waitli.top/api/v1';

async function test(lang) {
  const url = `${BASE}/books?status=active&lang=${lang}&limit=5&_t=${Date.now()}`;
  const res = await fetch(url, { dispatcher: agent });
  const d = await res.json();
  console.log(`\nlang=${lang}: ${d.data?.books?.length || 0} books`);
  for (const b of (d.data?.books || []).slice(0, 5)) {
    console.log(`  [${b.language || 'NO-LANG'}] ${b.title} (${b.genre})`);
  }
}

await test('zh');
await test('en');
await test('');
